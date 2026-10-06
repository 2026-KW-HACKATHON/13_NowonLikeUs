import type { AnswerItem, Confidence, ContractType, HousingType, QuestionItem, QuestionStatus } from './types';

/*
 * 질문 · 답변을 화면에 보낼 모양으로 바꾸는 순수 함수. DB 를 직접 부르지 않는다.
 * 숨김 답변을 빼는 것, "맞아요" 수와 "내가 눌렀는가"를 세는 것이 여기 걸려 있어서 단위 테스트한다.
 */

/** 답변 본문 한도. 화면 입력칸 maxLength 도 이 값을 쓴다. */
export const ANSWER_MAX = 500;

export const QUESTION_STATUSES: readonly QuestionStatus[] = ['OPEN', 'ANSWERED', 'PROMOTED'];

/** DB 에서 꺼낸 답변 한 줄. 작성자는 닉네임만 꺼낸다(이메일 금지). */
export interface AnswerRow {
  id: string;
  questionId: string;
  text: string;
  isHidden: boolean;
  createdAt: Date;
  author: { nickname: string };
  confirmations: { userId: string }[];
}

/** DB 에서 꺼낸 질문 한 줄 */
export interface QuestionRow {
  id: string;
  text: string;
  ctxHousingType: HousingType | null;
  ctxContractType: ContractType | null;
  aiAnswer: string | null;
  confidence: Confidence;
  status: QuestionStatus;
  createdAt: Date;
  asker: { nickname: string } | null;
  answers: AnswerRow[];
}

/** 답변 하나. 로그인하지 않았으면 viewerId 는 null 이고 confirmedByMe 는 항상 false 다. */
export function toAnswerItem(row: AnswerRow, viewerId: string | null): AnswerItem {
  return {
    id: row.id,
    questionId: row.questionId,
    authorNickname: row.author.nickname,
    text: row.text,
    confirmationCount: row.confirmations.length,
    confirmedByMe: viewerId !== null && row.confirmations.some((c) => c.userId === viewerId),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 답변 정렬: "맞아요"가 많은 순, 같으면 먼저 달린 순.
 * 확인을 많이 받은 답변이 위에 있어야 다음 사람이 믿을 만한 답부터 본다.
 */
export function byConfirmations(a: AnswerItem, b: AnswerItem): number {
  if (b.confirmationCount !== a.confirmationCount) return b.confirmationCount - a.confirmationCount;
  return a.createdAt.localeCompare(b.createdAt);
}

/**
 * 질문 하나와 답변들. 숨김 처리된 답변은 아예 빼고 내려준다.
 * AI 가 모른다고 한 질문(UNKNOWN)은 aiAnswer 를 null 로 내려 화면이 빈 문장을 띄우지 않게 한다.
 */
export function toQuestionItem(row: QuestionRow, viewerId: string | null): QuestionItem {
  const answers = row.answers
    .filter((a) => !a.isHidden)
    .map((a) => toAnswerItem(a, viewerId))
    .sort(byConfirmations);
  return {
    id: row.id,
    text: row.text,
    askerNickname: row.asker?.nickname ?? null,
    ctxHousingType: row.ctxHousingType,
    ctxContractType: row.ctxContractType,
    aiAnswer: row.confidence === 'UNKNOWN' ? null : row.aiAnswer,
    confidence: row.confidence,
    status: row.status,
    answers,
    createdAt: row.createdAt.toISOString(),
  };
}

/** `?status=` 쿼리. 모르는 값이면 null(=전부)이 아니라 undefined 로 돌려 400 을 낼 수 있게 한다. */
export function parseStatusFilter(value: string | null): QuestionStatus | null | undefined {
  if (value === null || value === '') return null;
  return (QUESTION_STATUSES as readonly string[]).includes(value) ? (value as QuestionStatus) : undefined;
}

export type AnswerTextResult = { ok: true; text: string } | { ok: false; error: string };

/** 답변 본문 검증. 앞뒤 공백을 지우고 1~500자. */
export function validateAnswerText(input: unknown): AnswerTextResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  }
  const { text } = input as Record<string, unknown>;
  if (typeof text !== 'string') return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  const trimmed = text.trim();
  const length = [...trimmed].length;
  if (length === 0 || length > ANSWER_MAX) {
    return { ok: false, error: `답변은 1~${ANSWER_MAX}자로 입력해 주세요.` };
  }
  return { ok: true, text: trimmed };
}
