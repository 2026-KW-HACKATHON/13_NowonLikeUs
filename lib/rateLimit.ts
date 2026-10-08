import type { ApiErrorResponse } from './types';

/*
 * 요청 횟수 제한. 로그인 없이 부르는 /api/ask 를 스크립트로 수백 번 부르면
 * 표지 · '이웃의 질문'이 장난 글로 덮이고 Gemini 할당량이 바닥난다.
 *
 * Vercel 서버리스는 인스턴스끼리 메모리를 나누지 않는다. 그래서 두 겹으로 막는다.
 * 1. IP별 메모리 제한 — 인스턴스마다 따로 센다. 한 곳에 몰리는 반복 호출을 DB · AI 에 닿기 전에 끊는다.
 * 2. DB 기준 상한 — 이미 있는 테이블의 createdAt 을 센다. 인스턴스가 몇 개든 같은 값을 보므로 총량은 여기서 막힌다.
 *    새 테이블을 만들지 않아 마이그레이션 없이 배포된다.
 *
 * 행사장처럼 여러 사람이 한 Wi-Fi(같은 공인 IP)를 쓰는 경우가 있어 IP별 한도는 넉넉하게 잡았다.
 */

export type RateWindow = { limit: number; windowMs: number };

const MINUTE = 60_000;

export const RATE_LIMITS = {
  /** 질문하기 — IP별(인스턴스마다) */
  askPerIp: { limit: 20, windowMs: MINUTE },
  /** 질문하기 — 전체(DB 의 최근 질문 수). Gemini 호출과 질문 저장 총량을 묶는다. */
  askTotal: { limit: 30, windowMs: MINUTE },
  /** 답변 작성 — IP별(인스턴스마다) */
  answerPerIp: { limit: 20, windowMs: MINUTE },
  /** 답변 작성 — 계정별(DB 의 내 최근 답변 수) */
  answerPerUser: { limit: 5, windowMs: MINUTE },
  /** 가입 — IP별(인스턴스마다) */
  signupPerIp: { limit: 20, windowMs: 10 * MINUTE },
  /** 가입 — 전체(DB 의 최근 가입 수) */
  signupTotal: { limit: 50, windowMs: 10 * MINUTE },
  /** 로그인 — IP별(인스턴스마다). 로그인은 DB 에 남는 행이 없어 메모리로만 센다. */
  loginPerIp: { limit: 20, windowMs: MINUTE },
} as const satisfies Record<string, RateWindow>;

/** 메모리에 들고 있을 IP 수 상한. 넘으면 가장 오래 안 쓴 IP 부터 버린다. */
const MAX_KEYS = 10_000;

/**
 * 최근 windowMs 동안의 요청 시각을 키별로 센다(슬라이딩 윈도).
 * hit 은 허용이면 0, 막히면 다시 시도할 수 있을 때까지 남은 초를 돌려준다. 막힌 요청은 세지 않는다.
 */
export function createLimiter({ limit, windowMs }: RateWindow, maxKeys = MAX_KEYS) {
  const hits = new Map<string, number[]>();
  return {
    hit(key: string, now = Date.now()): number {
      const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
      // 지웠다 다시 넣어 Map 순서를 "최근에 쓴 순"으로 유지한다.
      hits.delete(key);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value as string);
      return 0;
    },
  };
}

/**
 * 요청한 쪽 IP. Vercel 은 x-forwarded-for 를 클라이언트 IP 로 덮어써 보낸다.
 * 알 수 없으면 null — 이때는 IP별 제한을 건너뛰고 DB 기준 상한만 적용한다.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return request.headers.get('x-real-ip')?.trim() || null;
}

/** IP별 메모리 제한을 적용한다. 막히면 429 응답, 통과하면 null. */
export function limitByIp(limiter: ReturnType<typeof createLimiter>, request: Request): Response | null {
  const ip = clientIp(request);
  const wait = ip ? limiter.hit(ip) : 0;
  return wait > 0 ? tooManyRequests(wait) : null;
}

/** DB 에서 셀 때 쓰는 창의 시작 시각. */
export function windowStart({ windowMs }: RateWindow, now = Date.now()): Date {
  return new Date(now - windowMs);
}

export function tooManyRequests(retryAfterSeconds: number): Response {
  const body: ApiErrorResponse = { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' };
  return Response.json(body, {
    status: 429,
    headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))), 'Cache-Control': 'no-store' },
  });
}
