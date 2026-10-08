import { createHmac } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { prisma } from './db';
import type { ApiErrorResponse } from './types';

/*
 * 요청 횟수 제한. 로그인 없이 부르는 /api/ask 를 스크립트로 수백 번 부르면
 * 표지 · '이웃의 질문'이 장난 글로 덮이고 Gemini 할당량이 바닥난다.
 *
 * Vercel 서버리스는 인스턴스끼리 메모리를 나누지 않으므로 DB 의 RateLimitCounter 한 테이블에서 센다.
 * 키는 "제한 종류:대상:시간 구간 번호"이고, INSERT … ON CONFLICT DO UPDATE 로 더하고 결과를 한 번에 받는다.
 * 행 잠금 아래에서 더하므로 동시에 몰려도 같은 숫자를 두 번 받는 요청이 없다.
 *
 * 행사장처럼 여러 사람이 한 Wi-Fi(같은 공인 IP)를 쓰는 경우가 있어 IP별 한도는 넉넉하게 두고,
 * 계정별 · 전체 한도를 실제 방어선으로 쓴다.
 */

export type RateWindow = { limit: number; windowMs: number };

const MINUTE = 60_000;

export const RATE_LIMITS = {
  /** 질문하기 — 로그인한 계정별 */
  askPerUser: { limit: 10, windowMs: MINUTE },
  /** 질문하기 — 로그인 안 한 요청의 IP별 */
  askPerIp: { limit: 30, windowMs: MINUTE },
  /** 질문하기 — 전체. Gemini 호출과 질문 저장 총량을 묶는다. */
  askTotal: { limit: 40, windowMs: MINUTE },
  /** 답변 작성 — 계정별 */
  answerPerUser: { limit: 5, windowMs: MINUTE },
  /** 가입 — IP별 */
  signupPerIp: { limit: 60, windowMs: 10 * MINUTE },
  /** 가입 — 전체 */
  signupTotal: { limit: 100, windowMs: 10 * MINUTE },
  /** 로그인 — IP별 */
  loginPerIp: { limit: 100, windowMs: MINUTE },
  /** 로그인 — 이메일별. 한 계정에 비밀번호를 대입하는 속도를 늦춘다. */
  loginPerEmail: { limit: 10, windowMs: 10 * MINUTE },
} as const satisfies Record<string, RateWindow>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** 하나의 카운터. subject 는 IP · 계정 id · 이메일 같은 대상, 전체 한도면 '*'. */
export type RateBucket = { name: RateLimitName; subject: string };

export type CounterRow = { key: string; limit: number; expiresAt: Date };

/** 다 쓴 카운터를 지우는 확률. 매 요청마다 지우면 왕복이 하나 늘어서 가끔만 한다. */
const CLEANUP_RATE = 0.02;

/**
 * IP · 이메일은 그대로 저장하지 않는다. 서버 비밀키로 HMAC 한 앞 32자만 키에 넣는다.
 * '*'(전체 한도)는 그대로 둔다.
 */
export function hashSubject(subject: string): string {
  if (subject === '*') return subject;
  return createHmac('sha256', process.env.SESSION_SECRET ?? '').update(subject).digest('hex').slice(0, 32);
}

/** 버킷을 지금 시각의 고정 구간 카운터로 바꾼다. 구간이 끝나면 새 키로 넘어가 0부터 다시 센다. */
export function counterRow(bucket: RateBucket, now: number): CounterRow {
  const { limit, windowMs } = RATE_LIMITS[bucket.name];
  const slot = Math.floor(now / windowMs);
  return { key: `${bucket.name}:${hashSubject(bucket.subject)}:${slot}`, limit, expiresAt: new Date((slot + 1) * windowMs) };
}

/**
 * 카운터들을 앞에서부터 차례로 하나씩 올리는 SQL 한 문장.
 * 앞 카운터가 한도를 넘으면 뒤 카운터는 올리지 않는다 — IP 한도에 걸린 반복 호출이 전체 한도를 갉아먹어
 * 다른 사람까지 막히지 않게 한다. 결과는 c0, c1 … 열로 오고, 올리지 않은 카운터는 null 이다.
 */
export function counterQuery(rows: CounterRow[]): Prisma.Sql {
  const ctes = rows.map((row, i) => {
    // Prisma 는 DateTime 을 시간대 없는 UTC 로 저장한다. 세션 시간대와 무관하게 UTC 로 맞춘다.
    const values = Prisma.sql`${row.key}::text, 1, (${row.expiresAt}::timestamptz AT TIME ZONE 'UTC')`;
    const source = i === 0
      ? Prisma.sql`VALUES (${values})`
      : Prisma.sql`SELECT ${values} FROM ${Prisma.raw(`b${i - 1}`)} WHERE ${Prisma.raw(`b${i - 1}`)}."count" <= ${rows[i - 1].limit}::int`;
    return Prisma.sql`${Prisma.raw(`b${i}`)} AS (
  INSERT INTO "RateLimitCounter" ("key", "count", "expiresAt") ${source}
  ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimitCounter"."count" + 1
  RETURNING "count"
)`;
  });
  const columns = rows.map((_, i) => Prisma.raw(`(SELECT "count" FROM b${i}) AS c${i}`));
  return Prisma.sql`WITH ${Prisma.join(ctes, ',\n')}\nSELECT ${Prisma.join(columns, ', ')}`;
}

/** 카운터 결과를 보고, 한도를 넘었으면 그 구간이 끝날 때까지 남은 초를, 아니면 0 을 돌려준다. */
export function retryAfterSeconds(rows: CounterRow[], counts: (number | null)[], now: number): number {
  for (let i = 0; i < rows.length; i++) {
    const count = counts[i];
    if (count !== null && count > rows[i].limit) return Math.max(1, Math.ceil((rows[i].expiresAt.getTime() - now) / 1000));
  }
  return 0;
}

/**
 * 버킷들을 차례로 하나씩 올리고, 한도를 넘었으면 429 응답을, 통과면 null 을 돌려준다.
 * 카운터 테이블이 아직 없거나(마이그레이션 전 배포) DB 오류가 나면 막지 않고 통과시킨다 —
 * 제한 기능이 질문 · 로그인 자체를 멈추게 하면 안 된다. 이때는 고정된 분류만 로그에 남긴다.
 */
export async function consumeRateLimit(buckets: RateBucket[], now = Date.now()): Promise<Response | null> {
  if (buckets.length === 0) return null;
  const rows = buckets.map((bucket) => counterRow(bucket, now));
  let counts: (number | null)[];
  try {
    const [result] = await prisma.$queryRaw<Record<string, number | null>[]>(counterQuery(rows));
    counts = rows.map((_, i) => result?.[`c${i}`] ?? null);
  } catch (error) {
    const code = error instanceof Prisma.PrismaClientKnownRequestError && /^P\d{4}$/.test(error.code) ? ` ${error.code}` : '';
    console.warn(`[rate-limit] 카운터를 쓰지 못해 제한 없이 통과: ${buckets[0].name}${code}`);
    return null;
  }
  if (Math.random() < CLEANUP_RATE) {
    await prisma.rateLimitCounter.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }).catch(() => {});
  }
  const wait = retryAfterSeconds(rows, counts, now);
  return wait > 0 ? tooManyRequests(wait) : null;
}

/**
 * 요청한 쪽 IP. Vercel 은 x-forwarded-for 를 클라이언트 IP 로 덮어써 보낸다.
 * 알 수 없으면(로컬 개발 등) null — 이때는 IP별 버킷을 빼고 나머지 한도만 적용한다.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return request.headers.get('x-real-ip')?.trim() || null;
}

export function tooManyRequests(retryAfter: number): Response {
  const body: ApiErrorResponse = { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' };
  return Response.json(body, {
    status: 429,
    headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfter))), 'Cache-Control': 'no-store' },
  });
}
