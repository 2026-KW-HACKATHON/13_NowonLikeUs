import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { buildPromotionQueue } from '@/lib/promotion';
import { questionRowSelect } from '@/lib/questionSelect';
import { toQuestionItem, type QuestionRow } from '@/lib/questionView';
import type { PromotionQueueResponse } from '@/lib/types';

/** GET /api/admin/promotions — 승격 큐 (ADMIN). 답변이 달린 질문을 맞아요 합계가 많은 순으로. */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const rows: QuestionRow[] = await prisma.question.findMany({
    where: { status: 'ANSWERED' },
    orderBy: { createdAt: 'asc' },
    select: questionRowSelect,
  });

  const response: PromotionQueueResponse = {
    items: buildPromotionQueue(rows.map((row) => toQuestionItem(row, admin.id))),
  };
  return Response.json(response, { headers: { 'Cache-Control': 'no-store' } });
}
