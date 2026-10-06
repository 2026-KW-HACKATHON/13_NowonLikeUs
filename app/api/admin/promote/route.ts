import { prisma } from '@/lib/db';
import { readJsonBody, requireAdmin } from '@/lib/auth';
import { validatePromoteRequest } from '@/lib/promotion';
import type { ApiErrorResponse, PromoteResponse } from '@/lib/types';

function error(message: string, status: number) {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status });
}

/** 트랜잭션 안에서 승격할 수 없는 상태일 때 던지고, 바깥에서 응답 코드로 바꾼다. */
class NotPromotable extends Error {
  constructor(readonly status: 404 | 409, message: string) {
    super(message);
  }
}

/**
 * POST /api/admin/promote — 답변을 할 일로 발행한다 (ADMIN).
 *
 * 한 트랜잭션 안에서 ① 질문을 ANSWERED → PROMOTED 로 조건부 갱신하고 ② 할 일을 만든다.
 * 조건부 갱신을 먼저 하므로 운영자가 두 번 눌러도 할 일이 두 개 생기지 않고,
 * 할 일 생성이 실패하면 질문 상태도 함께 되돌아간다.
 * AI 초안(draft)과는 독립이다 — 초안이 없어도 운영자가 직접 채워 발행할 수 있다.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  // 검증 결과의 value 만 쓴다. 요청 본문을 직접 쓰지 않는다.
  const input = validatePromoteRequest(body);
  if (!input.ok) return error(input.error, 400);
  const { questionId, task, sourceNote } = input.value;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const moved = await tx.question.updateMany({
                // 보이는 답변이 하나도 없으면 갱신되지 않아 409(답변 없음)로 나간다.
        where: { id: questionId, status: 'ANSWERED', answers: { some: { isHidden: false } } },
        data: { status: 'PROMOTED' },
      });
      if (moved.count === 0) {
        const exists = await tx.question.findUnique({ where: { id: questionId }, select: { status: true } });
        if (!exists) throw new NotPromotable(404, '없는 질문입니다.');
        throw new NotPromotable(
          409,
          exists.status === 'PROMOTED' ? '이미 할 일로 정리된 질문입니다.' : '답변이 없는 질문은 승격할 수 없습니다.',
        );
      }

      // source · verifiedAt · isPublished 는 서버가 정한다.
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
    if (e instanceof NotPromotable) return error(e.message, e.status);
    throw e;
  }
}
