import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isNeighborhoodVerified } from '@/lib/neighborhood';
import type { MeResponse } from '@/lib/types';

/**
 * GET /api/auth/me — 지금 로그인한 사용자.
 * 로그인하지 않았으면 401 이 아니라 200 + { user: null } 이다. "로그인 안 함"은 정상 상태다.
 *
 * `neighborhoodVerified` 는 동네 인증이 유효한가(180일 이내)다. 로그인했을 때만 DB 를 한 번 읽는다.
 * 인증 날짜는 내려주지 않고 참 · 거짓만 준다.
 */
export async function GET() {
  const user = await getSessionUser();
  const account = user
    ? await prisma.user.findUnique({ where: { id: user.id }, select: { neighborhoodVerifiedAt: true } })
    : null;

  const response: MeResponse = {
    user,
    neighborhoodVerified: isNeighborhoodVerified(account?.neighborhoodVerifiedAt ?? null, new Date()),
  };
  return Response.json(response);
}
