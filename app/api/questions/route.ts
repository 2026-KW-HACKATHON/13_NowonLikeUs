import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { parseStatusFilter, toQuestionItem, type QuestionRow } from '@/lib/questionView';
import type { ApiErrorResponse, QuestionListResponse } from '@/lib/types';

/** 한 번에 내려주는 질문 수. 전시 기간 규모에서는 충분하다. */
const LIMIT = 100;

/**
 * GET /api/questions?status=OPEN|ANSWERED|PROMOTED — 최신순 질문 목록과 각 질문의 답변.
 * 로그인 없이 볼 수 있다. 로그인했으면 "내가 맞아요를 눌렀는가"를 함께 표시한다.
 */
export async function GET(request: Request) {
  const status = parseStatusFilter(new URL(request.url).searchParams.get('status'));
  if (status === undefined) {
    const error: ApiErrorResponse = { error: 'status 는 OPEN, ANSWERED, PROMOTED 중 하나여야 합니다.' };
    return Response.json(error, { status: 400 });
  }

  // 목록은 누구나 보는 화면이라, 세션을 못 읽어도 비로그인으로 보고 계속 보여준다.
  const viewer = await getSessionUser().catch(() => null);

  const rows: QuestionRow[] = await prisma.question.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
    select: {
      id: true,
      text: true,
      ctxHousingType: true,
      ctxContractType: true,
      aiAnswer: true,
      confidence: true,
      status: true,
      createdAt: true,
      asker: { select: { nickname: true } },
      answers: {
        where: { isHidden: false },
        select: {
          id: true,
          questionId: true,
          text: true,
          isHidden: true,
          createdAt: true,
          author: { select: { nickname: true } },
          confirmations: { select: { userId: true } },
        },
      },
    },
  });

  const response: QuestionListResponse = {
    questions: rows.map((row) => toQuestionItem(row, viewer?.id ?? null)),
  };
  return Response.json(response, { headers: { 'Cache-Control': 'no-store' } });
}
