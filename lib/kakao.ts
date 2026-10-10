import { SignJWT, jwtVerify } from 'jose';
import { safeNext } from './authView';

/*
 * 카카오 로그인 (OAuth 2.0 인가 코드 방식). 카카오와 실제로 통신하는 부분은 라우트에 두고,
 * 여기에는 주소 만들기 · 응답 해석 · 쿠키 값 만들기처럼 테스트할 수 있는 순수 함수만 둔다.
 *
 * 카카오에서 받는 정보는 회원번호(id) 하나다. 동의항목을 요청하지 않으므로 닉네임 · 이메일 ·
 * 전화번호는 오지 않는다. 카카오 닉네임은 실명인 경우가 많아, 답변에 보일 닉네임은 처음
 * 로그인할 때 이 서비스에서 따로 정한다.
 *
 * 흐름
 *   1. GET /api/auth/kakao           state 를 쿠키에 담고 카카오 로그인 화면으로 보낸다
 *   2. GET /api/auth/kakao/callback  state 확인 → 코드로 토큰 → 회원번호
 *        - 이미 가입한 회원번호면 바로 로그인
 *        - 처음이면 회원번호를 서명한 쿠키(10분)에 담고 닉네임 정하기 화면(/signup/kakao)으로
 *   3. POST /api/auth/kakao/complete 닉네임을 받아 계정을 만들고 로그인
 */

export const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';
export const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
export const KAKAO_ME_URL = 'https://kapi.kakao.com/v2/user/me';

/** 카카오로 오가는 동안만 쓰는 쿠키. 콜백까지 걸리는 시간이면 충분하다. */
export const KAKAO_STATE_COOKIE = 'wolgye.kakao-state';
export const KAKAO_PENDING_COOKIE = 'wolgye.kakao-pending';
export const KAKAO_COOKIE_MAX_AGE_SECONDS = 60 * 10;

/** 로그인 화면이 알아듣는 실패 사유. `/login?kakao=...` 로 넘긴다. */
export type KakaoLoginError = 'cancelled' | 'failed' | 'unavailable';

/**
 * 카카오 앱 키. REST API 키가 없으면 카카오 로그인을 끈다(버튼도 숨긴다).
 * client_secret 은 콘솔에서 "Client Secret" 을 켰을 때만 넣는다.
 */
export function kakaoConfig(env: Record<string, string | undefined>): { clientId: string; clientSecret?: string } | null {
  const clientId = env.KAKAO_REST_API_KEY?.trim();
  if (!clientId) return null;
  const clientSecret = env.KAKAO_CLIENT_SECRET?.trim();
  return clientSecret ? { clientId, clientSecret } : { clientId };
}

/** 카카오 개발자 콘솔에 등록하는 Redirect URI. 요청이 들어온 주소(origin)로 만든다 — 실서버 · localhost 둘 다 등록한다. */
export function kakaoCallbackUrl(origin: string): string {
  return `${origin}/api/auth/kakao/callback`;
}

/** 카카오 로그인 화면 주소. scope 를 보내지 않아 추가 동의를 받지 않는다. */
export function kakaoAuthorizeUrl({ clientId, redirectUri, state }: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(KAKAO_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

/** 토큰 요청 본문. client_secret 은 콘솔에서 켰을 때만 보낸다. */
export function kakaoTokenBody({
  clientId,
  clientSecret,
  redirectUri,
  code,
}: {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  code: string;
}): URLSearchParams {
  const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirectUri, code });
  if (clientSecret) body.set('client_secret', clientSecret);
  return body;
}

/** 토큰 응답에서 access_token 만. 모양이 다르면 null. */
export function parseKakaoToken(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const token = (json as Record<string, unknown>).access_token;
  return typeof token === 'string' && token !== '' ? token : null;
}

/**
 * 사용자 정보 응답에서 회원번호만 꺼내 문자열로. 다른 필드는 읽지 않는다.
 * 카카오 회원번호는 숫자로 온다. 안전한 정수 범위를 넘으면 자릿수가 틀어지므로 받지 않는다.
 */
export function parseKakaoId(json: unknown): string | null {
  if (typeof json !== 'object' || json === null) return null;
  const id = (json as Record<string, unknown>).id;
  if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) return String(id);
  if (typeof id === 'string' && /^[1-9]\d{0,18}$/.test(id)) return id;
  return null;
}

/** 콜백 쿼리 해석. 사용자가 동의 화면에서 취소하면 `error=access_denied` 로 돌아온다. */
export function readCallbackQuery(params: URLSearchParams): { code: string; state: string } | { error: KakaoLoginError } {
  const error = params.get('error');
  if (error) return { error: error === 'access_denied' ? 'cancelled' : 'failed' };
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return { error: 'failed' };
  return { code, state };
}

/** state 쿠키 값. 돌아갈 화면(next)도 같이 담는다. */
export function encodeStateCookie(state: string, next: string): string {
  return JSON.stringify({ state, next });
}

/**
 * state 쿠키를 읽고 카카오가 돌려준 state 와 맞춰 본다. 다르면 다른 사람이 만든 로그인 요청을
 * 내 브라우저에 끼워 넣은 것일 수 있다(CSRF) — null.
 * next 는 쿠키 값이라도 다시 safeNext 로 거른다.
 */
export function checkStateCookie(raw: string | undefined, returnedState: string): { next: string } | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { state, next } = parsed as Record<string, unknown>;
  if (typeof state !== 'string' || state.length < 16 || !sameString(state, returnedState)) return null;
  return { next: safeNext(typeof next === 'string' ? next : undefined) };
}

/** 길이가 같을 때 끝까지 비교한다. 앞 글자에서 일찍 끝나면 걸린 시간으로 값을 짐작할 수 있다. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * 처음 로그인한 카카오 회원번호를 닉네임을 정할 때까지 들고 있는 토큰(10분).
 * 세션 토큰과 같은 비밀키를 쓰므로 audience 로 구분한다 — 이 토큰은 세션으로 통하지 않고,
 * 세션 토큰도 이 자리에 쓸 수 없다(세션 토큰에는 audience 가 없다).
 */
const PENDING_AUDIENCE = 'kakao-signup';

function toKey(secret: string): Uint8Array {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('세션 비밀키가 없거나 32자보다 짧습니다.');
  return new TextEncoder().encode(secret);
}

export async function signKakaoPending(
  { kakaoId, next }: { kakaoId: string; next: string },
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ next })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(kakaoId)
    .setAudience(PENDING_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + KAKAO_COOKIE_MAX_AGE_SECONDS)
    .sign(toKey(secret));
}

export async function verifyKakaoPending(
  token: string | undefined,
  secret: string,
): Promise<{ kakaoId: string; next: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, toKey(secret), { algorithms: ['HS256'], audience: PENDING_AUDIENCE });
    if (typeof payload.sub !== 'string' || !/^[1-9]\d{0,18}$/.test(payload.sub)) return null;
    return { kakaoId: payload.sub, next: safeNext(typeof payload.next === 'string' ? payload.next : undefined) };
  } catch {
    return null;
  }
}
