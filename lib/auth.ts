import 'server-only';

import { cookies } from 'next/headers';
import { prisma } from './db';
import { SESSION_MAX_AGE_SECONDS, signSession, verifySession } from './session';
import type { ApiErrorResponse, SessionUser } from './types';

/*
 * 쿠키를 다루는 서버 전용 코드는 여기 한 곳에만 둔다.
 * 질문 · 답변 · 승격 API 는 모두 아래 가드(requireUser · requireAdmin)를 직접 호출한다.
 */

export const SESSION_COOKIE = 'wolgye.session';

const MIN_SECRET_LENGTH = 32;

/** 비밀키가 없거나 짧으면 약한 키로 조용히 동작하지 않고 바로 멈춘다. */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET 환경변수가 없거나 ${MIN_SECRET_LENGTH}자보다 짧습니다. .env 를 확인하세요.`);
  }
  return secret;
}

function errorResponse(error: string, status: number): Response {
  const body: ApiErrorResponse = { error };
  return Response.json(body, { status });
}

/** 로그인 성공 시 세션 쿠키를 심는다. Route Handler 안에서만 부를 수 있다. */
export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await signSession(user, getSessionSecret());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** 세션 쿠키를 지운다. 로그인하지 않은 상태에서 불러도 문제없다. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/** 지금 로그인한 사용자. 로그인하지 않았거나 토큰이 잘못됐으면 null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const secret = getSessionSecret();
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value, secret);
}

/**
 * 토큰 속 사용자를 DB 에서 다시 읽는다. 계정이 지워졌으면 null.
 * 토큰의 닉네임 · role 은 최대 7일 전 값이라, 여기서 읽은 최신 값을 돌려준다.
 */
async function loadAccount(user: SessionUser): Promise<SessionUser | null> {
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, nickname: true, role: true },
  });
  return row ? { id: row.id, nickname: row.nickname, role: row.role } : null;
}

/**
 * 토큰은 맞는데 계정이 없을 때(지운 계정의 쿠키가 남은 경우).
 * 쿠키를 지우고 401 을 돌려준다 — 그대로 두면 답변 · 맞아요 저장에서 외래키 오류로 500 이 난다.
 * 화면은 401 을 받으면 로그인 상태를 새로 읽으므로 "로그인" 버튼으로 바뀐다.
 */
async function accountGone(): Promise<Response> {
  await clearSessionCookie();
  return errorResponse('로그인이 필요합니다.', 401);
}

/**
 * 로그인이 필요한 API 의 첫 줄. 로그인하지 않았거나 계정이 없으면 401 응답을 돌려준다.
 * 글을 저장하는 API 만 부르므로, 계정 확인 쿼리 한 번이 더 붙어도 괜찮다.
 */
export async function requireUser(): Promise<SessionUser | Response> {
  const user = await getSessionUser();
  if (!user) return errorResponse('로그인이 필요합니다.', 401);

  const account = await loadAccount(user);
  if (!account) return accountGone();
  return account;
}

/**
 * 운영자 전용 API 의 첫 줄. 비로그인 401, 일반 회원 403.
 * 토큰의 role 은 최대 7일 전 값이라 믿지 않고 DB 에서 다시 읽는다 — 권한을 회수하면 바로 막혀야 한다.
 */
export async function requireAdmin(): Promise<SessionUser | Response> {
  const user = await getSessionUser();
  if (!user) return errorResponse('로그인이 필요합니다.', 401);

  const account = await loadAccount(user);
  if (!account) return accountGone();
  if (account.role !== 'ADMIN') return errorResponse('운영자만 할 수 있습니다.', 403);
  return account;
}

/**
 * 변경 요청(POST)의 본문을 JSON 으로 읽는다. Content-Type 이 JSON 이 아니거나 깨졌으면 400 응답.
 * SameSite=Lax 쿠키와 함께 CSRF 를 기본적으로 막는다.
 */
export async function readJsonBody(request: Request): Promise<unknown | Response> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return errorResponse('요청 형식이 올바르지 않습니다.', 400);
  }
  try {
    return await request.json();
  } catch {
    return errorResponse('요청 형식이 올바르지 않습니다.', 400);
  }
}
