import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { sortQueue, totalConfirmations } from '@/lib/promotion';
import { questionSelect, toQuestionItem, type QuestionRow } from '@/lib/questionView';
import type { PromotionQueueResponse } from '@/lib/types';

/**
 * GET /api/admin/promotions — 승격 큐 (ADMIN, role 은 DB 재조회).
 * ANSWERED 만 담는다 — OPEN 은 근거가 없어 승격 불가, PROMOTED 는 끝난 것.
 * 확인 수 0 인 질문도 담는다. 확인 수는 조건이 아니라 정렬 기준이다.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const rows: QuestionRow[] = await prisma.question.findMany({
        // 답변이 전부 숨김이면 근거가 없어 큐에 넣지 않는다.
    where: { status: 'ANSWERED', answers: { some: { isHidden: false } } },
    select: questionSelect(admin.id),
  });

  const items = rows.map((row) => {
      const question = toQuestionItem(row, { viewerId: admin.id, showAsker: true });
    return { question, totalConfirmations: totalConfirmations(question.answers) };
  });

  const response: PromotionQueueResponse = { items: sortQueue(items) };
  return Response.json(response, { headers: { 'Cache-Control': 'no-store' } });
}
