import { SignJWT, jwtVerify } from 'jose';
import type { SessionUser } from './types';

/** 세션 유효기간 7일 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const MIN_SECRET_LENGTH = 32;

/** 비밀키를 환경변수에서 읽지 않고 인자로 받는다. 테스트마다 process.env 를 조작하지 않기 위해서다. */
function toKey(secret: string): Uint8Array {
  if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`세션 비밀키가 없거나 ${MIN_SECRET_LENGTH}자보다 짧습니다.`);
  }
  return new TextEncoder().encode(secret);
}

/**
 * 로그인한 사용자로 세션 토큰(HS256 JWT)을 만든다.
 * 토큰에는 id(sub) · 닉네임 · 역할만 담는다. 이메일 같은 개인정보는 넣지 않는다.
 * `now` 는 테스트에서 "오래전에 발급된 토큰"을 만들 때만 넘긴다.
 */
export async function signSession(user: SessionUser, secret: string, now: Date = new Date()): Promise<string> {
  const key = toKey(secret);
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ nickname: user.nickname, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_MAX_AGE_SECONDS)
    .sign(key);
}

/** 토큰을 검증해 사용자를 돌려준다. 없거나, 위조됐거나, 만료됐거나, 모양이 이상하면 null 이다. */
export async function verifySession(token: string | undefined, secret: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    // algorithms 를 고정해서 alg: none 같은 위조 토큰을 거절한다.
    const { payload } = await jwtVerify(token, toKey(secret), { algorithms: ['HS256'] });
    const { sub, nickname, role } = payload;
    if (typeof sub !== 'string' || typeof nickname !== 'string') return null;
    if (role !== 'MEMBER' && role !== 'ADMIN') return null;
    return { id: sub, nickname, role };
  } catch {
    return null;
  }
}
