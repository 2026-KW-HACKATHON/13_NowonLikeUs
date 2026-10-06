import { prisma } from '@/lib/db';
import { readJsonBody, requireUser } from '@/lib/auth';
import { validateAnswer } from '@/lib/answerValidation';
import { answerSelect, toAnswerItem } from '@/lib/questionView';
import type { ApiErrorResponse, CreateAnswerResponse } from '@/lib/types';

function error(message: string, status: number) {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status });
}

/**
 * POST /api/questions/[id]/answers — 주민이 질문에 답변을 단다 (로그인 필요).
 * 첫 답변이 달리면 질문이 OPEN → ANSWERED 가 되어 운영자 승격 큐에 들어간다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth instanceof Response) return auth;

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  const input = validateAnswer(body);
  if (!input.ok) return error(input.error, 400);

  const { id } = await params;
  const question = await prisma.question.findUnique({ where: { id }, select: { status: true } });
  if (!question) return error('없는 질문입니다.', 404);
  if (question.status === 'PROMOTED') return error('이미 할 일로 정리된 질문입니다.', 409);

  const created = await prisma.$transaction(async (tx) => {
    const answer = await tx.answer.create({
      data: { questionId: id, authorId: auth.id, text: input.value.text },
      select: answerSelect(auth.id),
    });
    // 조건부 갱신이라 동시에 여러 답변이 달려도 결과가 같다. 이미 ANSWERED 면 그대로 둔다.
    await tx.question.updateMany({ where: { id, status: 'OPEN' }, data: { status: 'ANSWERED' } });
    return answer;
  });

  const response: CreateAnswerResponse = { answer: toAnswerItem(created) };
  return Response.json(response, { status: 201 });
}
