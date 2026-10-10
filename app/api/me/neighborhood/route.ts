import { prisma } from '@/lib/db';
import { readJsonBody, requireUser } from '@/lib/auth';
import type { ApiErrorResponse, NeighborhoodResponse } from '@/lib/types';

/*
 * 노원 동네 인증 (로그인 필요). 인증은 선택이고, 답변 · "맞아요"를 막지 않는다 — 답변 옆 배지만 바뀐다.
 *
 * 위치 판정은 브라우저(lib/neighborhood.ts checkPosition)에서 끝난다. 서버는 "인증했다"만 받고 시각만 남긴다.
 * 좌표는 받지도 저장하지도 않는다 — 서비스가 개인 위치정보를 갖지 않게 하려는 결정이다.
 * 그래서 개발자 도구로 이 API 를 직접 부르면 속일 수 있다. 배지는 참고용이고, 오정보를 막는 관문은
 * 운영자의 출처 확인이다(알고 고른 한계).
 */

function error(message: string, status: number) {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status });
}

/**
 * 계정에 인증 시각을 쓴다. 0건이면 확인과 저장 사이에 계정이 지워진 경우라 401.
 * update 대신 updateMany 를 써서 그 경우에도 500 이 아니라 401 이 나가게 한다.
 */
async function saveVerifiedAt(userId: string, verifiedAt: Date | null): Promise<Response> {
  const { count } = await prisma.user.updateMany({
    where: { id: userId },
    data: { neighborhoodVerifiedAt: verifiedAt },
  });
  if (count === 0) return error('로그인이 필요합니다.', 401);

  const response: NeighborhoodResponse = { verifiedAt: verifiedAt ? verifiedAt.toISOString() : null };
  return Response.json(response);
}

/**
 * POST /api/me/neighborhood — 인증하기. 본문은 `{}`.
 * readJsonBody 로 JSON 형식만 확인하고(CSRF 방어) 내용은 읽지 않는다 — 좌표 필드가 와도 버린다.
 * 다시 누르면 시각만 지금으로 바뀐다(180일이 새로 시작).
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof Response) return auth;

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  return saveVerifiedAt(auth.id, new Date());
}

/**
 * DELETE /api/me/neighborhood — 인증 지우기. 인증하지 않은 상태에서 불러도 오류가 아니다.
 * 본문이 없어 Content-Type 검사의 예외다. DELETE 는 SameSite=Lax 쿠키가 다른 사이트에서 실리지 않는다.
 */
export async function DELETE() {
  const auth = await requireUser();
  if (auth instanceof Response) return auth;

  return saveVerifiedAt(auth.id, null);
}
