import type { AnswerItem, Confidence, ContractType, HousingType, QuestionItem, QuestionStatus } from './types';

/*
 * 질문 · 답변을 화면에 보낼 모양으로 바꾸는 순수 함수와, 그 모양으로 꺼내는 Prisma select.
 * DB 를 직접 부르지 않는다.
 */

export const QUESTION_STATUSES: readonly QuestionStatus[] = ['OPEN', 'ANSWERED', 'PROMOTED'];

/**
 * 질문 + 답변 select. 숨긴 답변은 빼고, 답변은 오래된 순(대화처럼 읽히게).
 * 작성자 · 질문자는 닉네임만 꺼낸다 — 이메일 · 해시는 절대 꺼내지 않는다.
 * "내가 눌렀는가"는 내 확인 행만 골라 존재 여부로 본다. 비로그인이면 아무 행도 걸리지 않는다.
 */
export function questionSelect(viewerId: string | null) {
  return {
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
      orderBy: { createdAt: 'asc' as const },
      select: answerSelect(viewerId),
    },
  };
}

/** 답변 하나 select. 답변 작성 응답도 같은 모양을 쓴다. */
export function answerSelect(viewerId: string | null) {
  return {
    id: true,
    questionId: true,
    text: true,
    createdAt: true,
    author: { select: { nickname: true } },
    _count: { select: { confirmations: true } },
    // 비로그인이면 어떤 사용자 id 와도 같지 않은 빈 문자열로 걸러 항상 빈 배열이 된다.
    confirmations: { where: { userId: viewerId ?? '' }, select: { id: true } },
  };
}

/** DB 에서 꺼낸 답변 한 줄 */
export interface AnswerRow {
  id: string;
  questionId: string;
  text: string;
  createdAt: Date;
  author: { nickname: string };
  _count: { confirmations: number };
  /** 내가 누른 확인 행. 있으면 1개, 없으면 빈 배열 */
  confirmations: { id: string }[];
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

export function toAnswerItem(row: AnswerRow): AnswerItem {
  return {
    id: row.id,
    questionId: row.questionId,
    authorNickname: row.author.nickname,
    text: row.text,
    confirmationCount: row._count.confirmations,
    confirmedByMe: row.confirmations.length > 0,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 질문 하나와 답변들. 답변 순서는 DB 에서 정한 순서(오래된 순)를 그대로 둔다.
 * AI 가 모른다고 한 질문(UNKNOWN)은 aiAnswer 를 null 로 내린다(`lib/types.ts` 계약).
 */
export function toQuestionItem(row: QuestionRow): QuestionItem {
  return {
    id: row.id,
    text: row.text,
    askerNickname: row.asker?.nickname ?? null,
    ctxHousingType: row.ctxHousingType,
    ctxContractType: row.ctxContractType,
    aiAnswer: row.confidence === 'UNKNOWN' ? null : row.aiAnswer,
    confidence: row.confidence,
    status: row.status,
    answers: row.answers.map(toAnswerItem),
    createdAt: row.createdAt.toISOString(),
  };
}

/** `?status=` 쿼리. 없으면 null(전부), 모르는 값이면 undefined(400). */
export function parseStatusFilter(value: string | null): QuestionStatus | null | undefined {
  if (value === null || value === '') return null;
  return (QUESTION_STATUSES as readonly string[]).includes(value) ? (value as QuestionStatus) : undefined;
}
