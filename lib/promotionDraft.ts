import { DUE_OFFSET_MAX } from './promotion';
import type { ContractType, HousingType, TaskCategory, TaskDraft } from './types';

/*
 * 승격 AI 초안(docs/승격시스템흐름.md ⑤)의 입력 정리와 출력 검증. 순수 로직만 둔다(서버 코드 import 금지).
 *
 * 초안은 제안일 뿐이다. 운영자가 양식에서 고치고 출처를 적어야 발행된다(⑥).
 * 그래도 AI 가 답변에 없는 숫자 · 주소 · 링크를 지어내면 운영자가 놓칠 수 있어서,
 * 주민 답변에서 확인되지 않는 값은 여기서 비워서 내려보낸다 — "숫자는 AI 가 다시 쓰지 않는다".
 * 질문은 AI 가 맥락을 잡는 데만 쓰고 대조 근거로는 쓰지 않는다. 질문은 근거가 아니라 물음이다.
 */

const CATEGORIES: readonly TaskCategory[] = ['ADMIN', 'WASTE', 'HOUSING', 'LIFE'];

/** 양식 칸 길이와 맞춘다(lib/promotion.ts). 넘치면 자른다 — 어차피 운영자가 다시 본다. */
const LIMITS = { title: 80, why: 300, howTo: 1000, field: 200 } as const;

/** AI 에 보내는 원문. 닉네임 · id · 확인 수는 넣지 않는다 — 내용만 있으면 된다. */
export interface DraftSource {
  question: string;
  answers: string[];
  /** 질문한 사람의 상황 스냅샷. 노출 조건 제안은 이 안에서만 남는다. */
  askerHousingType: HousingType | null;
  askerContractType: ContractType | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numbersIn(text: string): string[] {
  return text.match(/\d+/g) ?? [];
}

function urlsIn(text: string): string[] {
  return text.match(/(?:https?:\/\/|www\.)[^\s)]+/gi) ?? [];
}

/**
 * 글에 나온 숫자 · 링크가 전부 답변에도 있는가. "14일" 이 답변에 없는데 초안에 있으면 지어낸 것이다.
 * "정부24" 같은 이름 속 숫자도 답변에 없으면 걸린다 — 놓치는 쪽보다 비우는 쪽이 안전하다.
 */
export function fromAnswers(text: string, answers: string): boolean {
  const known = new Set(numbersIn(answers));
  return numbersIn(text).every((n) => known.has(n)) && urlsIn(text).every((url) => answers.includes(url));
}

/**
 * 이사일 기준 기한인가. 같은 답변 안에 "이사" · "전입" 과 "N일" 이 함께 있어야 한다.
 * "3일마다 수거" 처럼 이사일과 상관없는 숫자, "2주" → 14 같은 환산은 버린다 — 법정 기한은 틀리면 과태료다.
 */
export function isMoveInDeadline(days: number, answers: string[]): boolean {
  const daysPattern = new RegExp(`(^|\\D)${days}\\s*일`);
  return answers.some((answer) => /이사|전입/.test(answer) && daysPattern.test(answer));
}

function clip(value: string, max: number): string {
  return [...value].slice(0, max).join('');
}

/** 문장 칸: 문자열이 아니거나, 답변에 없는 숫자 · 링크가 섞이면 빈 칸으로 둔다. */
function text(value: unknown, max: number, answers: string): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return fromAnswers(trimmed, answers) ? clip(trimmed, max) : '';
}

/** 링크 · 장소 · 전화: 답변에 글자 그대로 있을 때만 쓴다. AI 가 찾아 넣은 주소는 확인할 길이 없다. */
function verbatim(value: unknown, answers: string): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '' || !answers.includes(trimmed)) return null;
  return clip(trimmed, LIMITS.field);
}

/** 노출 조건 제안은 질문자 상황 안에서만 남긴다. 질문자 상황이 없으면 조건 없음(빈 배열)이다. */
function withinAsker<T extends string>(value: unknown, asker: T | null): T[] {
  if (asker === null || !Array.isArray(value)) return [];
  return value.includes(asker) ? [asker] : [];
}

/** AI 응답 → 양식에 채울 초안. 분류조차 못 고른 응답은 null(빈 양식으로 넘어간다). */
export function sanitizeDraft(raw: unknown, source: DraftSource): TaskDraft | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.category !== 'string' || !(CATEGORIES as readonly string[]).includes(raw.category)) return null;
  const answers = source.answers.join('\n');

  const due = raw.dueOffsetDays;
  const dueOffsetDays =
    typeof due === 'number' && Number.isInteger(due) && due >= 0 && due <= DUE_OFFSET_MAX && isMoveInDeadline(due, source.answers)
      ? due
      : null;

  return {
    title: text(raw.title, LIMITS.title, answers),
    why: text(raw.why, LIMITS.why, answers),
    howTo: text(raw.howTo, LIMITS.howTo, answers),
    category: raw.category as TaskCategory,
    dueOffsetDays,
    linkUrl: verbatim(raw.linkUrl, answers),
    placeName: verbatim(raw.placeName, answers),
    placeAddress: verbatim(raw.placeAddress, answers),
    placePhone: verbatim(raw.placePhone, answers),
    housingTypes: withinAsker(raw.housingTypes, source.askerHousingType),
    contractTypes: withinAsker(raw.contractTypes, source.askerContractType),
    // 차 · 반려동물 · 학생 조건은 질문자 상황에 없어 근거가 없고, 잘못 켜면 필요한 사람에게 안 보인다. 운영자가 고른다.
    requiresCar: false,
    requiresPet: false,
    studentOnly: false,
  };
}
