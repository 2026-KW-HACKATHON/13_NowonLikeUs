import { prisma } from '@/lib/db';
import { readJsonBody, requireAdmin } from '@/lib/auth';
import { draftPromotionWithGemini } from '@/lib/gemini';
import { sanitizeDraft, type DraftSource } from '@/lib/promotionDraft';
import type { ApiErrorResponse, PromoteDraftResponse } from '@/lib/types';

function error(message: string, status: number) {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status });
}

function noDraft() {
  const body: PromoteDraftResponse = { draft: null };
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * POST /api/admin/promote/draft — 승격 양식의 AI 초안 (ADMIN). 아무것도 저장하지 않는다.
 *
 * AI 를 못 쓰면(스위치 꺼짐 · 키 없음 · 호출 실패 · 형식 오류) 200 과 `draft: null` 로 답한다.
 * 화면은 빈 양식을 띄우고 운영자가 직접 쓴다 — 승격이 AI 에 막히면 안 된다.
 * 초안의 값은 원문과 대조해 확인되지 않는 숫자 · 주소 · 링크를 비운 뒤 내려보낸다(lib/promotionDraft.ts).
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;
  const questionId = typeof body === 'object' && body !== null && 'questionId' in body ? body.questionId : null;
  if (typeof questionId !== 'string' || questionId.trim() === '') return error('요청 형식이 올바르지 않습니다.', 400);

  const question = await prisma.question.findUnique({
    where: { id: questionId.trim() },
    select: {
      text: true,
      status: true,
      ctxHousingType: true,
      ctxContractType: true,
      // 숨긴 답변은 근거가 아니다. 작성자 · 확인 수는 AI 에 보내지 않는다.
      answers: { where: { isHidden: false }, orderBy: { createdAt: 'asc' }, select: { text: true } },
    },
  });
  if (!question) return error('없는 질문입니다.', 404);
  if (question.status !== 'ANSWERED' || question.answers.length === 0) {
    return error('답변이 달린 질문만 초안을 만들 수 있습니다.', 409);
  }

  // 주민 질문 · 답변을 외부로 보내는 일이라 질문 화면과 같은 스위치를 따른다.
  // TODO(권섭): 운영자 초안만 따로 켜는 스위치가 필요한지 결정.
  if (process.env.GEMINI_ALLOW_USER_INPUT !== 'true') return noDraft();

  const source: DraftSource = {
    question: question.text,
    answers: question.answers.map((a) => a.text),
    askerHousingType: question.ctxHousingType,
    askerContractType: question.ctxContractType,
  };
  const raw = await draftPromotionWithGemini(source);
  const draft = raw === null ? null : sanitizeDraft(raw, source);
  if (raw !== null && draft === null) console.warn('[gemini] 호출 실패: draft-schema');

  const response: PromoteDraftResponse = { draft };
  return Response.json(response, { headers: { 'Cache-Control': 'no-store' } });
}
