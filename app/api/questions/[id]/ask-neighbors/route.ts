import { prisma } from '@/lib/db';
import { getSessionUser, readJsonBody } from '@/lib/auth';
import { canAskNeighbors } from '@/lib/questionView';
import type { ApiErrorResponse, AskNeighborsResponse } from '@/lib/types';

function error(message: string, status: number) {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status });
}

/**
 * POST /api/questions/[id]/ask-neighbors — "원하는 답이 아니에요 → 이웃에게 물어보기".
 * 확인된 답(GROUNDED)을 받은 질문은 목록에서 빠지는데, 질문자가 원하면 '이웃의 질문'에 올린다.
 * 질문은 원래 로그인 없이 쓰므로 로그인은 강제하지 않는다. 권한은 canAskNeighbors 가 정한다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // 본문은 쓰지 않지만 JSON 만 받아 다른 사이트의 폼 전송(CSRF)을 막는다.
  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  const { id } = await params;
  const viewer = await getSessionUser().catch(() => null);
  const question = await prisma.question.findUnique({ where: { id }, select: { askerId: true } });
  if (!question) return error('없는 질문입니다.', 404);
  if (!canAskNeighbors(question, viewer?.id ?? null)) return error('질문한 사람만 이웃에게 물을 수 있습니다.', 403);

  // GROUNDED 가 아닌 질문은 이미 목록에 있다. 그래도 표시만 남기고 같은 응답을 준다(여러 번 눌러도 같다).
  await prisma.question.update({ where: { id }, data: { askNeighbors: true }, select: { id: true } });
  const response: AskNeighborsResponse = { questionId: id };
  return Response.json(response, { headers: { 'Cache-Control': 'no-store' } });
}
