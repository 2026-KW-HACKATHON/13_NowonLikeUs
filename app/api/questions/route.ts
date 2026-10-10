import { prisma } from '@/lib/db';
import { getSessionUser, requireUser } from '@/lib/auth';
import { boardWhere, mineWhere, parseStatusFilter, questionSelect, toQuestionItem, type QuestionRow } from '@/lib/questionView';
import type { ApiErrorResponse, QuestionListResponse } from '@/lib/types';

/** 해커톤 규모에서 페이지네이션은 범위 밖이라 상한만 둔다. */
const LIMIT = 50;

/**
 * GET /api/questions?status=OPEN|ANSWERED|PROMOTED — 질문 최신순, 답변은 오래된 순.
 * 로그인 없이 볼 수 있다. 로그인했으면 "내가 맞아요를 눌렀는가"를 함께 표시한다.
 * 확인된 정보로 이미 답한(GROUNDED) 질문은 주민에게 다시 물을 이유가 없어 뺀다.
 * 단, 질문자가 "원하는 답이 아니에요"로 이웃에게 넘긴 질문은 GROUNDED 여도 보인다.
 *
 * GET /api/questions?mine=1 — 로그인한 사람이 쓴 질문만, 상태를 섞어서(비로그인 401).
 * 응답 모양은 같다. 질문자 닉네임은 여기서도 싣지 않는다 — 내 질문이라는 건 이미 안다.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get('mine') === '1') return listMine();

  const status = parseStatusFilter(params.get('status'));
  if (status === undefined) {
    const error: ApiErrorResponse = { error: '질문 상태 값이 올바르지 않습니다.' };
    return Response.json(error, { status: 400 });
  }

  // 로그인을 강제하지 않는다. 세션을 못 읽어도 비로그인으로 보고 목록은 보여준다.
  const viewer = await getSessionUser().catch(() => null);

  const rows: QuestionRow[] = await prisma.question.findMany({
    where: boardWhere(status),
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
    select: questionSelect(viewer?.id ?? null),
  });

  const viewerId = viewer?.id ?? null;
  const response: QuestionListResponse = { questions: rows.map((row) => toQuestionItem(row, { viewerId })) };
  return Response.json(response, { headers: { 'Cache-Control': 'no-store' } });
}

async function listMine() {
  const viewer = await requireUser();
  if (viewer instanceof Response) return viewer;

  const rows: QuestionRow[] = await prisma.question.findMany({
    where: mineWhere(viewer.id),
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
    select: questionSelect(viewer.id),
  });

  const response: QuestionListResponse = { questions: rows.map((row) => toQuestionItem(row, { viewerId: viewer.id })) };
  return Response.json(response, { headers: { 'Cache-Control': 'no-store' } });
}
