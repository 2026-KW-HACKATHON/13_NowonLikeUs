import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import type { ApiErrorResponse, ConfirmAnswerResponse } from '@/lib/types';

function error(message: string, status: number) {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status });
}

/**
 * POST /api/answers/[id]/confirm — "맞아요" (로그인 필요). 본문이 없어 Content-Type 검사의 예외다.
 *
 * 같은 사람이 두 번 눌러도 오류가 아니다. 본인 답변에는 누를 수 없다 —
 * 자기 답변에 확인을 누르면 승격 큐 순위를 혼자 올릴 수 있다.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const answer = await prisma.answer.findUnique({ where: { id }, select: { authorId: true, isHidden: true } });
  // 숨긴 답변은 존재 자체를 숨긴다.
  if (!answer || answer.isHidden) return error('없는 답변입니다.', 404);
  if (answer.authorId === auth.id) return error('내가 쓴 답변은 확인할 수 없습니다.', 403);

  try {
    await prisma.confirmation.create({ data: { answerId: id, userId: auth.id } });
  } catch (e) {
    // @@unique([answerId, userId]) 위반 = 이미 눌렀다. 더블클릭이어도 성공으로 처리한다.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
  }

  const confirmationCount = await prisma.confirmation.count({ where: { answerId: id } });
  const response: ConfirmAnswerResponse = { confirmationCount, confirmedByMe: true };
  return Response.json(response);
}
