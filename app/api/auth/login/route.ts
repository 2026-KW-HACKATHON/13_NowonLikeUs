import { prisma } from '@/lib/db';
import { readJsonBody, setSessionCookie } from '@/lib/auth';
import { validateLogin } from '@/lib/authValidation';
import { verifyPassword } from '@/lib/password';
import { createLimiter, limitByIp, RATE_LIMITS } from '@/lib/rateLimit';
import type { ApiErrorResponse, AuthResponse, SessionUser } from '@/lib/types';

/** 없는 이메일과 틀린 비밀번호의 메시지가 같아야 가입 여부를 알아낼 수 없다. */
const LOGIN_FAILED = '이메일 또는 비밀번호가 맞지 않습니다.';

/** 로그인은 DB 에 남는 행이 없어 IP별 메모리 제한만 둔다(비밀번호 대입 속도를 늦추는 용도). */
const ipLimiter = createLimiter(RATE_LIMITS.loginPerIp);

/** POST /api/auth/login */
export async function POST(request: Request) {
  const limited = limitByIp(ipLimiter, request);
  if (limited) return limited;

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  const input = validateLogin(body);
  if (!input.ok) {
    const error: ApiErrorResponse = { error: input.error };
    return Response.json(error, { status: 400 });
  }

  const row = await prisma.user.findUnique({
    where: { email: input.value.email },
    select: { id: true, nickname: true, role: true, passwordHash: true },
  });

  // 없는 계정이어도 verifyPassword 를 부른다. 안에서 가짜 해시와 한 번 비교해 응답 시간을 맞춘다.
  const matched = await verifyPassword(input.value.password, row?.passwordHash ?? null);
  if (!row || !matched) {
    const error: ApiErrorResponse = { error: LOGIN_FAILED };
    return Response.json(error, { status: 401 });
  }

  // 해시는 비교에만 쓰고 여기서 버린다.
  const user: SessionUser = { id: row.id, nickname: row.nickname, role: row.role };
  await setSessionCookie(user);
  const response: AuthResponse = { user };
  return Response.json(response);
}
