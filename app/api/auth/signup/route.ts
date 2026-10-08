import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readJsonBody, setSessionCookie } from '@/lib/auth';
import { validateSignup } from '@/lib/authValidation';
import { hashPassword } from '@/lib/password';
import { createLimiter, limitByIp, RATE_LIMITS, tooManyRequests, windowStart } from '@/lib/rateLimit';
import type { ApiErrorResponse, AuthResponse, SessionUser } from '@/lib/types';

const ipLimiter = createLimiter(RATE_LIMITS.signupPerIp);

/** POST /api/auth/signup — 가입 후 바로 로그인 상태로 만든다. 가입은 항상 MEMBER 다. */
export async function POST(request: Request) {
  const limited = limitByIp(ipLimiter, request);
  if (limited) return limited;

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  const input = validateSignup(body);
  if (!input.ok) {
    const error: ApiErrorResponse = { error: input.error };
    return Response.json(error, { status: 400 });
  }

  // 인스턴스끼리 메모리를 나누지 않아 IP 제한만으로는 총량이 막히지 않는다. 최근 가입 수는 모든 인스턴스가 같은 값을 본다.
  const recentSignups = await prisma.user.count({ where: { createdAt: { gte: windowStart(RATE_LIMITS.signupTotal) } } });
  if (recentSignups >= RATE_LIMITS.signupTotal.limit) return tooManyRequests(RATE_LIMITS.signupTotal.windowMs / 1000);

  const passwordHash = await hashPassword(input.value.password);

  let user: SessionUser;
  try {
    user = await prisma.user.create({
      data: {
        email: input.value.email,
        passwordHash,
        nickname: input.value.nickname,
        role: 'MEMBER',
      },
      // 응답과 토큰에 이메일 · 해시가 섞이지 않게 필요한 컬럼만 꺼낸다.
      select: { id: true, nickname: true, role: true },
    });
  } catch (e) {
    // 같은 이메일로 동시에 가입하면 둘 다 중복 검사를 통과할 수 있다. DB 의 unique 위반을 잡아 409 로 바꾼다.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const error: ApiErrorResponse = { error: '이미 가입된 이메일입니다.' };
      return Response.json(error, { status: 409 });
    }
    throw e;
  }

  await setSessionCookie(user);
  const response: AuthResponse = { user };
  return Response.json(response, { status: 201 });
}
