import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import type { ApiErrorResponse, ConfirmAnswerResponse } from '@/lib/types';

function error(message: string, status: number) {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status });
}

/**
 * POST /api/answers/[id]/confirm — "맞아요" (로그인 필요). 본문은 없어도 된다.
 *
 * 같은 사람이 두 번 눌러도 오류가 아니다. 이미 눌렀으면 현재 값을 그대로 돌려준다.
 * 자기 답변에는 누를 수 없다 — 스스로 확인 수를 올리면 승격 큐 순서가 의미를 잃는다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // 변경 요청은 JSON 으로만 받는다(SameSite=Lax 와 함께 CSRF 기본 완화). 본문은 비어 있어도 된다.
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return error('요청 형식이 올바르지 않습니다.', 400);
  }

  const auth = await requireUser();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const answer = await prisma.answer.findUnique({ where: { id }, select: { authorId: true, isHidden: true } });
  if (!answer || answer.isHidden) return error('없는 답변입니다.', 404);
  if (answer.authorId === auth.id) return error('내 답변에는 누를 수 없습니다.', 403);

  try {
    await prisma.confirmation.create({ data: { answerId: id, userId: auth.id } });
  } catch (e) {
    // @@unique([answerId, userId]) — 이미 눌렀으면 그대로 진행한다.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
  }

  const confirmationCount = await prisma.confirmation.count({ where: { answerId: id } });
  const response: ConfirmAnswerResponse = { confirmationCount, confirmedByMe: true };
  return Response.json(response);
}
