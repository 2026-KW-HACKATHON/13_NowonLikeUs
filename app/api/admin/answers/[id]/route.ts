import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { readJsonBody, requireAdmin } from '@/lib/auth';
import { validateHideAnswer } from '@/lib/moderation';
import type { ApiErrorResponse, HideAnswerResponse } from '@/lib/types';

function error(message: string, status: number) {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status });
}

/**
 * PATCH /api/admin/answers/[id] — 운영자가 답변을 숨기거나 다시 보이게 한다 (ADMIN, role 은 DB 재조회).
 * 본문: `{ "isHidden": true }` 숨기기 · `{ "isHidden": false }` 되돌리기.
 *
 * 숨긴 답변은 목록 · 승격 큐 · "맞아요"에서 모두 빠진다(이미 그렇게 읽고 있다). 지우지 않고 숨기는 이유:
 * 잘못 숨겼을 때 되돌릴 수 있어야 하고, 남이 눌러 둔 "맞아요"를 함부로 없애지 않기 위해서다.
 *
 * 질문 상태도 같이 맞춘다.
 * - 숨겨서 보이는 답변이 하나도 안 남으면 ANSWERED → OPEN (근거가 없어 승격 큐에서도 빠진다)
 * - 다시 보이게 하면 OPEN → ANSWERED
 * - PROMOTED 는 건드리지 않는다
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  const input = validateHideAnswer(body);
  if (!input.ok) return error(input.error, 400);

  const { id } = await params;
  const answer = await prisma.answer.findUnique({ where: { id }, select: { questionId: true } });
  if (!answer) return error('없는 답변입니다.', 404);

  const { questionId } = answer;
  const { isHidden } = input.value;

  try {
    // 분기가 요청 전에 끝나서 배치 트랜잭션으로 한 번에 보낸다. 배치는 적힌 순서대로 실행되므로
    // 두 번째 조건부 갱신은 첫 번째(숨김 변경)가 반영된 상태를 본다. 여러 번 보내도 결과가 같다.
    const [, , question] = await prisma.$transaction([
      prisma.answer.update({ where: { id }, data: { isHidden } }),
      isHidden
        ? prisma.question.updateMany({
            where: { id: questionId, status: 'ANSWERED', answers: { none: { isHidden: false } } },
            data: { status: 'OPEN' },
          })
        : prisma.question.updateMany({
            where: { id: questionId, status: 'OPEN' },
            data: { status: 'ANSWERED' },
          }),
      prisma.question.findUniqueOrThrow({ where: { id: questionId }, select: { status: true } }),
    ]);

    const response: HideAnswerResponse = { answerId: id, isHidden, questionStatus: question.status };
    return Response.json(response);
  } catch (e) {
    // 확인과 갱신 사이에 질문이 지워진 경우(답변도 같이 지워진다).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return error('없는 답변입니다.', 404);
    }
    throw e;
  }
}
