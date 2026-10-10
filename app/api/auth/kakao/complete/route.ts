import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { clearKakaoPendingCookie, readJsonBody, readKakaoPending, setSessionCookie } from '@/lib/auth';
import { validateKakaoSignup } from '@/lib/authValidation';
import type { ApiErrorResponse, KakaoSignupResponse, SessionUser } from '@/lib/types';

/**
 * POST /api/auth/kakao/complete — 카카오로 처음 로그인한 사람의 닉네임을 받아 계정을 만든다.
 * 회원번호는 요청 본문이 아니라 콜백이 서명해 둔 쿠키에서만 읽는다(본문으로 받으면 남의 번호로 가입할 수 있다).
 * 가입은 항상 MEMBER 다.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  const input = validateKakaoSignup(body);
  if (!input.ok) {
    const error: ApiErrorResponse = { error: input.error };
    return Response.json(error, { status: 400 });
  }

  const pending = await readKakaoPending();
  if (!pending) {
    const error: ApiErrorResponse = { error: '카카오 로그인 시간이 지났습니다. 다시 카카오로 로그인해 주세요.' };
    return Response.json(error, { status: 401 });
  }

  const select = { id: true, nickname: true, role: true } as const;
  let user: SessionUser;
  try {
    user = await prisma.user.create({
      data: { kakaoId: pending.kakaoId, nickname: input.value.nickname, role: 'MEMBER' },
      select,
    });
  } catch (e) {
    // 버튼을 두 번 눌러 같은 회원번호로 동시에 만들면 하나는 unique 위반이 난다. 먼저 만든 계정으로 로그인시킨다.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    const existing = await prisma.user.findUnique({ where: { kakaoId: pending.kakaoId }, select });
    if (!existing) throw e;
    user = existing;
  }

  await clearKakaoPendingCookie();
  await setSessionCookie(user);
  const response: KakaoSignupResponse = { user, next: pending.next };
  return Response.json(response, { status: 201 });
}
