import type {
  ContractType,
  HousingType,
  PromoteRequest,
  PromotionQueueItem,
  TaskCategory,
  TaskDraft,
} from './types';

/*
 * 승격 — 주민 답변을 다음 사람의 할 일로 올리는 단계. 순수 로직만 둔다(서버 코드 import 금지).
 * 확인 수는 승격 조건이 아니라 정렬 기준이다(docs/승격시스템흐름.md 7절). 판단은 운영자가 한다.
 */

/** 이사일 기준 기한은 1년 안쪽만 받는다. 그보다 길면 이사일 기준 할 일이 아니다. */
export const DUE_OFFSET_MAX = 365;

const TITLE_MAX = 80;
const WHY_MAX = 300;
const HOW_TO_MAX = 1000;
const FIELD_MAX = 200;
const SOURCE_NOTE_MAX = 500;

const CATEGORIES: readonly TaskCategory[] = ['ADMIN', 'WASTE', 'HOUSING', 'LIFE'];
const HOUSING_TYPES: readonly HousingType[] = ['ONE_ROOM', 'OFFICETEL', 'DORM', 'APARTMENT', 'VILLA'];
const CONTRACT_TYPES: readonly ContractType[] = ['MONTHLY', 'JEONSE', 'DORM_FEE', 'OWNED'];
const BAD_REQUEST = '요청 형식이 올바르지 않습니다.';

/** 답변들의 "맞아요" 합계 */
export function totalConfirmations(answers: { confirmationCount: number }[]): number {
  return answers.reduce((sum, a) => sum + a.confirmationCount, 0);
}

/** 승격 큐 정렬: 확인 수 많은 순, 같으면 먼저 물어본 순. 원본 배열은 바꾸지 않는다. */
export function sortQueue(items: PromotionQueueItem[]): PromotionQueueItem[] {
  return [...items].sort((a, b) => {
    if (b.totalConfirmations !== a.totalConfirmations) return b.totalConfirmations - a.totalConfirmations;
    return a.question.createdAt.localeCompare(b.question.createdAt);
  });
}

export type PromoteValidation = { ok: true; value: PromoteRequest } | { ok: false; error: string };

type Field<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 마지막 글자에 받침이 있는가. 한글이 아니면 false(받침 없음으로 본다). */
function hasFinalConsonant(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

/** "출처를", "제목을" — 받침에 맞는 목적격 조사를 붙인다. 화면에 그대로 띄우는 문장이라 "을(를)" 로 두지 않는다. */
export function withObject(word: string): string {
  return `${word}${hasFinalConsonant(word) ? '을' : '를'}`;
}

/** "출처는", "제목은" — 받침에 맞는 보조사를 붙인다. */
export function withTopic(word: string): string {
  return `${word}${hasFinalConsonant(word) ? '은' : '는'}`;
}

/** 필수 문자열: 앞뒤 공백을 지우고 1~max 자 */
function required(value: unknown, label: string, max: number): Field<string> {
  if (typeof value !== 'string') return { ok: false, error: `${withObject(label)} 입력해 주세요.` };
  const trimmed = value.trim();
  const length = [...trimmed].length;
  if (length === 0) return { ok: false, error: `${withObject(label)} 입력해 주세요.` };
  if (length > max) return { ok: false, error: `${withTopic(label)} ${max}자 이하로 입력해 주세요.` };
  return { ok: true, value: trimmed };
}

/** 선택 문자열: 없거나 빈 문자열이면 null */
function optional(value: unknown, label: string): Field<string | null> {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: BAD_REQUEST };
  const trimmed = value.trim();
  if (trimmed === '') return { ok: true, value: null };
  if ([...trimmed].length > FIELD_MAX) return { ok: false, error: `${withTopic(label)} ${FIELD_MAX}자 이하로 입력해 주세요.` };
  return { ok: true, value: trimmed };
}

/** 정해진 값만 담긴 목록인지. 중복은 지운다. 빈 배열은 "조건 없음(전원)" 이다. */
function enumList<T extends string>(value: unknown, allowed: readonly T[]): T[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === 'string' && (allowed as readonly string[]).includes(v))) return null;
  return [...new Set(value as T[])];
}

/**
 * 운영자가 보낸 승격 요청 검증. 통과하면 정리된 값만 돌려준다.
 * 결과에는 정해진 필드만 담는다 — 요청에 끼워 넣은 source · verifiedAt · isPublished 는 버린다.
 */
export function validatePromoteRequest(input: unknown): PromoteValidation {
  if (!isRecord(input) || !isRecord(input.task)) return { ok: false, error: BAD_REQUEST };
  if (typeof input.questionId !== 'string' || input.questionId.trim() === '') return { ok: false, error: BAD_REQUEST };

  // 모든 할 일은 출처가 있어야 한다. 승격된 할 일의 출처는 "누가 무엇을 근거로 확정했는가"다.
  const sourceNote = required(input.sourceNote, '출처', SOURCE_NOTE_MAX);
  if (!sourceNote.ok) return sourceNote;

  const t = input.task;
  const title = required(t.title, '제목', TITLE_MAX);
  if (!title.ok) return title;
  const why = required(t.why, '안 하면 생기는 일', WHY_MAX);
  if (!why.ok) return why;
  const howTo = required(t.howTo, '하는 방법', HOW_TO_MAX);
  if (!howTo.ok) return howTo;

  if (typeof t.category !== 'string' || !(CATEGORIES as readonly string[]).includes(t.category)) {
    return { ok: false, error: '분류를 골라 주세요.' };
  }

  // AI 초안이 틀리게 제안하기 쉬운 값이라 서버가 한 번 더 막는다. 이사일 기준이 아니면 null.
  const due = t.dueOffsetDays;
  if (due !== null && (typeof due !== 'number' || !Number.isInteger(due) || due < 0 || due > DUE_OFFSET_MAX)) {
    return { ok: false, error: `기한은 비워 두거나 0~${DUE_OFFSET_MAX} 사이의 일수로 입력해 주세요.` };
  }

  const linkUrl = optional(t.linkUrl, '링크');
  if (!linkUrl.ok) return linkUrl;
  // 카드의 "신청 페이지 열기"로 그대로 나간다. javascript: 같은 주소가 들어가면 안 된다.
  if (linkUrl.value !== null && !/^https?:\/\/\S+$/i.test(linkUrl.value)) {
    return { ok: false, error: '링크는 http:// 또는 https:// 로 시작해야 합니다.' };
  }
  const placeName = optional(t.placeName, '장소 이름');
  if (!placeName.ok) return placeName;
  const placeAddress = optional(t.placeAddress, '주소');
  if (!placeAddress.ok) return placeAddress;
  const placePhone = optional(t.placePhone, '전화번호');
  if (!placePhone.ok) return placePhone;

  const housingTypes = enumList(t.housingTypes, HOUSING_TYPES);
  const contractTypes = enumList(t.contractTypes, CONTRACT_TYPES);
  if (!housingTypes || !contractTypes) return { ok: false, error: '노출 조건이 올바르지 않습니다.' };
  if (typeof t.requiresCar !== 'boolean' || typeof t.requiresPet !== 'boolean' || typeof t.studentOnly !== 'boolean') {
    return { ok: false, error: '노출 조건이 올바르지 않습니다.' };
  }

  const task: TaskDraft = {
    title: title.value,
    why: why.value,
    howTo: howTo.value,
    category: t.category as TaskCategory,
    dueOffsetDays: due,
    linkUrl: linkUrl.value,
    placeName: placeName.value,
    placeAddress: placeAddress.value,
    placePhone: placePhone.value,
    housingTypes,
    contractTypes,
    requiresCar: t.requiresCar,
    requiresPet: t.requiresPet,
    studentOnly: t.studentOnly,
  };
  return { ok: true, value: { questionId: input.questionId.trim(), task, sourceNote: sourceNote.value } };
}
