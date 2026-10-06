import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { parseStatusFilter, questionSelect, toQuestionItem, type QuestionRow } from '@/lib/questionView';
import type { ApiErrorResponse, QuestionListResponse } from '@/lib/types';

/** 해커톤 규모에서 페이지네이션은 범위 밖이라 상한만 둔다. */
const LIMIT = 50;

/**
 * GET /api/questions?status=OPEN|ANSWERED|PROMOTED — 질문 최신순, 답변은 오래된 순.
 * 로그인 없이 볼 수 있다. 로그인했으면 "내가 맞아요를 눌렀는가"를 함께 표시한다.
 * 확인된 정보로 이미 답한(GROUNDED) 질문은 주민에게 다시 물을 이유가 없어 뺀다.
 */
export async function GET(request: Request) {
  const status = parseStatusFilter(new URL(request.url).searchParams.get('status'));
  if (status === undefined) {
    const error: ApiErrorResponse = { error: '질문 상태 값이 올바르지 않습니다.' };
    return Response.json(error, { status: 400 });
  }

  // 로그인을 강제하지 않는다. 세션을 못 읽어도 비로그인으로 보고 목록은 보여준다.
  const viewer = await getSessionUser().catch(() => null);

  const rows: QuestionRow[] = await prisma.question.findMany({
    where: { confidence: { not: 'GROUNDED' }, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
    select: questionSelect(viewer?.id ?? null),
  });

  const response: QuestionListResponse = { questions: rows.map(toQuestionItem) };
  return Response.json(response, { headers: { 'Cache-Control': 'no-store' } });
}
