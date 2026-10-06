import type {
  ContractType,
  HousingType,
  PromoteRequest,
  PromotionQueueItem,
  QuestionItem,
  TaskCategory,
  TaskDraft,
} from './types';

/*
 * 승격 — 주민 답변을 다음 사람의 할 일로 올리는 단계. 순수 로직만 둔다(단위 테스트 대상).
 * 승격 큐에 무엇이 들어가고 어떤 순서로 보이는지, 운영자가 보낸 할 일 내용이 발행해도 되는 모양인지가 여기 걸린다.
 */

export const TITLE_MAX = 80;
export const WHY_MAX = 300;
export const HOW_TO_MAX = 1000;
export const PLACE_MAX = 200;
export const SOURCE_NOTE_MAX = 500;
/** 이사일 기준 기한은 1년 안쪽만 받는다. 그보다 길면 이사일 기준 할 일이 아니다. */
export const DUE_OFFSET_MAX = 365;

const CATEGORIES: readonly TaskCategory[] = ['ADMIN', 'WASTE', 'HOUSING', 'LIFE'];
const HOUSING_TYPES: readonly HousingType[] = ['ONE_ROOM', 'OFFICETEL', 'DORM', 'APARTMENT', 'VILLA'];
const CONTRACT_TYPES: readonly ContractType[] = ['MONTHLY', 'JEONSE', 'DORM_FEE', 'OWNED'];

/** 질문 하나의 모든 답변에 달린 "맞아요" 합계 */
export function totalConfirmations(question: QuestionItem): number {
  return question.answers.reduce((sum, a) => sum + a.confirmationCount, 0);
}

/**
 * 승격 큐. 답변이 달린(ANSWERED) 질문만 넣고, 맞아요 합계가 많은 순으로 세운다.
 * 합계가 같으면 오래 기다린 질문이 먼저다. 확인 수는 정렬 기준일 뿐 승격 조건이 아니다 — 판단은 운영자가 한다.
 */
export function buildPromotionQueue(questions: QuestionItem[]): PromotionQueueItem[] {
  return questions
    .filter((q) => q.status === 'ANSWERED' && q.answers.length > 0)
    .map((question) => ({ question, totalConfirmations: totalConfirmations(question) }))
    .sort((a, b) => {
      if (b.totalConfirmations !== a.totalConfirmations) return b.totalConfirmations - a.totalConfirmations;
      return a.question.createdAt.localeCompare(b.question.createdAt);
    });
}

export type PromoteResult = { ok: true; value: PromoteRequest } | { ok: false; error: string };

const BAD_REQUEST = '요청 형식이 올바르지 않습니다.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function chars(text: string): number {
  return [...text].length;
}

/** 필수 문자열: 앞뒤 공백을 지우고 1~max 자 */
function requiredText(value: unknown, label: string, max: number): string | { error: string } {
  if (typeof value !== 'string') return { error: BAD_REQUEST };
  const trimmed = value.trim();
  if (chars(trimmed) === 0) return { error: `${label}을(를) 입력해 주세요.` };
  if (chars(trimmed) > max) return { error: `${label}은(는) ${max}자 이하로 입력해 주세요.` };
  return trimmed;
}

/** 선택 문자열: 비었으면 null, 아니면 0~max 자 */
function optionalText(value: unknown, label: string, max: number): string | null | { error: string } {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return { error: BAD_REQUEST };
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (chars(trimmed) > max) return { error: `${label}은(는) ${max}자 이하로 입력해 주세요.` };
  return trimmed;
}

/** 목록 값 검증: 허용된 값만, 중복 제거. 빈 배열은 "조건 없음(전원)" 이다. */
function enumList<T extends string>(value: unknown, allowed: readonly T[]): T[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === 'string' && (allowed as readonly string[]).includes(v))) return null;
  return [...new Set(value as T[])];
}

function isError(value: unknown): value is { error: string } {
  return isRecord(value) && typeof value.error === 'string';
}

/**
 * 운영자가 보낸 승격 요청 검증. 통과하면 정리된 값만 돌려준다.
 * 출처(sourceNote)가 비면 거절한다 — 모든 할 일은 출처가 있어야 하고,
 * 승격된 할 일의 출처는 "누가 무엇을 근거로 확정했는가"다.
 */
export function validatePromoteRequest(input: unknown): PromoteResult {
  if (!isRecord(input) || !isRecord(input.task)) return { ok: false, error: BAD_REQUEST };

  const questionId = input.questionId;
  if (typeof questionId !== 'string' || questionId.trim() === '') return { ok: false, error: BAD_REQUEST };

  const sourceNote = requiredText(input.sourceNote, '출처', SOURCE_NOTE_MAX);
  if (isError(sourceNote)) return { ok: false, error: sourceNote.error };

  const t = input.task;
  const title = requiredText(t.title, '제목', TITLE_MAX);
  if (isError(title)) return { ok: false, error: title.error };
  const why = requiredText(t.why, '안 하면 생기는 일', WHY_MAX);
  if (isError(why)) return { ok: false, error: why.error };
  const howTo = requiredText(t.howTo, '하는 방법', HOW_TO_MAX);
  if (isError(howTo)) return { ok: false, error: howTo.error };

  if (typeof t.category !== 'string' || !(CATEGORIES as readonly string[]).includes(t.category)) {
    return { ok: false, error: '분류를 골라 주세요.' };
  }

  // 이사일 기준 기한이 아니면 null. AI 가 틀리게 제안하기 쉬워서 운영자가 확인하는 자리다.
  const due = t.dueOffsetDays;
  if (due !== null && (typeof due !== 'number' || !Number.isInteger(due) || due < 0 || due > DUE_OFFSET_MAX)) {
    return { ok: false, error: `기한은 비워 두거나 0~${DUE_OFFSET_MAX} 사이의 일수로 입력해 주세요.` };
  }

  const linkUrl = optionalText(t.linkUrl, '링크', PLACE_MAX);
  if (isError(linkUrl)) return { ok: false, error: linkUrl.error };
  if (linkUrl !== null && !/^https?:\/\/\S+$/.test(linkUrl)) {
    return { ok: false, error: '링크는 http:// 또는 https:// 로 시작해야 합니다.' };
  }
  const placeName = optionalText(t.placeName, '장소 이름', PLACE_MAX);
  if (isError(placeName)) return { ok: false, error: placeName.error };
  const placeAddress = optionalText(t.placeAddress, '주소', PLACE_MAX);
  if (isError(placeAddress)) return { ok: false, error: placeAddress.error };
  const placePhone = optionalText(t.placePhone, '전화번호', PLACE_MAX);
  if (isError(placePhone)) return { ok: false, error: placePhone.error };

  const housingTypes = enumList(t.housingTypes, HOUSING_TYPES);
  const contractTypes = enumList(t.contractTypes, CONTRACT_TYPES);
  if (!housingTypes || !contractTypes) return { ok: false, error: '노출 조건이 올바르지 않습니다.' };
  if (typeof t.requiresCar !== 'boolean' || typeof t.requiresPet !== 'boolean' || typeof t.studentOnly !== 'boolean') {
    return { ok: false, error: '노출 조건이 올바르지 않습니다.' };
  }

  const task: TaskDraft = {
    title,
    why,
    howTo,
    category: t.category as TaskCategory,
    dueOffsetDays: due,
    linkUrl,
    placeName,
    placeAddress,
    placePhone,
    housingTypes,
    contractTypes,
    requiresCar: t.requiresCar,
    requiresPet: t.requiresPet,
    studentOnly: t.studentOnly,
  };
  return { ok: true, value: { questionId: questionId.trim(), task, sourceNote } };
}
