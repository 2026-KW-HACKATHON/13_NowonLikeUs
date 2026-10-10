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
 * "내가 썼는가"는 작성자 id 를 꺼내 toAnswerItem 에서 비교만 하고, id 자체는 응답에 싣지 않는다.
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
    // "내가 썼는가" 비교용. 응답에는 내보내지 않는다(다른 사람 id 노출 방지).
    authorId: true,
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
  /** 비교용. 응답에는 싣지 않는다. */
  authorId: string;
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

/**
 * 답변 하나. viewerId 는 지금 로그인한 사람의 id(비로그인이면 null).
 * 작성자 id 는 비교에만 쓰고 결과에 담지 않는다 — confirmedByMe 와 같은 방식이다.
 */
export function toAnswerItem(row: AnswerRow, viewerId: string | null): AnswerItem {
  return {
    id: row.id,
    questionId: row.questionId,
    authorNickname: row.author.nickname,
    text: row.text,
    confirmationCount: row._count.confirmations,
    confirmedByMe: row.confirmations.length > 0,
    authoredByMe: viewerId !== null && row.authorId === viewerId,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface QuestionItemOptions {
  /** 지금 로그인한 사람의 id. 비로그인이면 null(기본값). */
  viewerId?: string | null;
  /** 질문자 닉네임을 보여줄지. 운영자 승격 큐에서만 true. */
  showAsker?: boolean;
}

/**
 * 질문 하나와 답변들. 답변 순서는 DB 에서 정한 순서(오래된 순)를 그대로 둔다.
 * AI 가 모른다고 한 질문(UNKNOWN)은 aiAnswer 를 null 로 내린다(`lib/types.ts` 계약).
 */
// 질문은 원래 익명이다. 공개 목록에는 닉네임을 내리지 않고, 운영자 승격 큐에서만 보여준다.
export function toQuestionItem(row: QuestionRow, { viewerId = null, showAsker = false }: QuestionItemOptions = {}): QuestionItem {
  return {
    id: row.id,
    text: row.text,
    askerNickname: showAsker ? (row.asker?.nickname ?? null) : null,
    ctxHousingType: row.ctxHousingType,
    ctxContractType: row.ctxContractType,
    aiAnswer: row.confidence === 'UNKNOWN' ? null : row.aiAnswer,
    confidence: row.confidence,
    status: row.status,
    answers: row.answers.map((answer) => toAnswerItem(answer, viewerId)),
    createdAt: row.createdAt.toISOString(),
  };
}

/** `?status=` 쿼리. 없으면 null(전부), 모르는 값이면 undefined(400). */
export function parseStatusFilter(value: string | null): QuestionStatus | null | undefined {
  if (value === null || value === '') return null;
  return (QUESTION_STATUSES as readonly string[]).includes(value) ? (value as QuestionStatus) : undefined;
}

/**
 * '이웃의 질문' 목록 조건. 확인된 답(GROUNDED)을 받은 질문은 빼되,
 * 질문자가 이웃에게 넘긴(askNeighbors) 질문은 남긴다. status 가 null 이면 상태는 거르지 않는다.
 */
export function boardWhere(status: QuestionStatus | null) {
  return {
    OR: [{ confidence: { not: 'GROUNDED' as const } }, { askNeighbors: true }],
    ...(status ? { status } : {}),
  };
}

/**
 * "내 질문" 목록 조건. 이웃의 질문 목록에 올라간 질문 중 내가 로그인해서 쓴 것만, 상태는 섞어서.
 * 확인된 정보로 바로 답한 질문은 이웃이 답할 일이 없어 목록과 똑같이 뺀다.
 * 비로그인으로 쓴 질문은 askerId 가 없어 누구 것인지 알 수 없으므로 여기 나오지 않는다.
 */
export function mineWhere(viewerId: string) {
  return { ...boardWhere(null), askerId: viewerId };
}

/**
 * 이 사람이 질문을 이웃에게 넘길 수 있는가. 로그인해서 쓴 질문은 그 사람만,
 * 비로그인으로 쓴 질문은 질문 id 를 아는 사람(결과 화면을 본 질문자)만 넘길 수 있다.
 * GROUNDED 질문 id 는 목록에 나오지 않아 질문자 말고는 모른다.
 */
export function canAskNeighbors(question: { askerId: string | null }, viewerId: string | null): boolean {
  return question.askerId === null || question.askerId === viewerId;
}
