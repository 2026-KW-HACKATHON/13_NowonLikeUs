import { prisma } from '@/lib/db';
import { readJsonBody, requireAdmin } from '@/lib/auth';
import { validatePromoteRequest } from '@/lib/promotion';
import type { ApiErrorResponse, PromoteResponse } from '@/lib/types';

function error(message: string, status: number) {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status });
}

/** 트랜잭션 안에서 상태가 맞지 않을 때 던지는 표시. 응답 코드로 바꾼다. */
class PromoteConflict extends Error {}

/**
 * POST /api/admin/promote — 답변을 할 일로 승격한다 (ADMIN).
 * 할 일을 발행하고 질문을 PROMOTED 로 바꾸는 일을 한 트랜잭션으로 묶는다 — 둘 중 하나만 되면 안 된다.
 * 발행하는 즉시 다음 사람의 /api/tasks/match 결과에 같은 규칙(lib/matching.ts)으로 걸린다.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  const input = validatePromoteRequest(body);
  if (!input.ok) return error(input.error, 400);
  const { questionId, task, sourceNote } = input.value;

  const question = await prisma.question.findUnique({ where: { id: questionId }, select: { status: true } });
  if (!question) return error('없는 질문입니다.', 404);
  if (question.status === 'OPEN') return error('답변이 달리지 않은 질문은 승격할 수 없습니다.', 409);
  if (question.status === 'PROMOTED') return error('이미 승격된 질문입니다.', 409);

  try {
    const created = await prisma.$transaction(async (tx) => {
      // 두 운영자가 동시에 눌러도 한 번만 승격되도록, ANSWERED 일 때만 바꾸고 바뀐 수를 확인한다.
      const moved = await tx.question.updateMany({
        where: { id: questionId, status: 'ANSWERED' },
        data: { status: 'PROMOTED' },
      });
      if (moved.count !== 1) throw new PromoteConflict();

      return tx.task.create({
        data: {
          ...task,
          source: 'PROMOTED',
          promotedFromQuestionId: questionId,
          sourceNote,
          verifiedAt: new Date(),
          isPublished: true,
        },
        select: { id: true },
      });
    });

    const response: PromoteResponse = { taskId: created.id };
    return Response.json(response, { status: 201 });
  } catch (e) {
    if (e instanceof PromoteConflict) return error('이미 승격된 질문입니다.', 409);
    throw e;
  }
}
