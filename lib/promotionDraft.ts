import { DUE_OFFSET_MAX } from './promotion';
import type { ContractType, HousingType, TaskCategory, TaskDraft } from './types';

/*
 * 승격 AI 초안(docs/승격시스템흐름.md ⑤)의 입력 정리와 출력 검증. 순수 로직만 둔다(서버 코드 import 금지).
 *
 * 초안은 제안일 뿐이다. 운영자가 양식에서 고치고 출처를 적어야 발행된다(⑥).
 * 그래도 AI 가 원문에 없는 숫자 · 주소 · 링크를 지어내면 운영자가 놓칠 수 있어서,
 * 원문에서 확인되지 않는 값은 여기서 비워서 내려보낸다 — "숫자는 AI 가 다시 쓰지 않는다".
 */

const CATEGORIES: readonly TaskCategory[] = ['ADMIN', 'WASTE', 'HOUSING', 'LIFE'];
const HOUSING_TYPES: readonly HousingType[] = ['ONE_ROOM', 'OFFICETEL', 'DORM', 'APARTMENT', 'VILLA'];
const CONTRACT_TYPES: readonly ContractType[] = ['MONTHLY', 'JEONSE', 'DORM_FEE', 'OWNED'];

/** 양식 칸 길이와 맞춘다(lib/promotion.ts). 넘치면 자른다 — 어차피 운영자가 다시 본다. */
const LIMITS = { title: 80, why: 300, howTo: 1000, field: 200 } as const;

/** AI 에 보내는 원문. 닉네임 · id · 확인 수는 넣지 않는다 — 내용만 있으면 된다. */
export interface DraftSource {
  question: string;
  answers: string[];
  /** 질문한 사람의 상황 스냅샷. 노출 조건 제안의 근거다. */
  askerHousingType: HousingType | null;
  askerContractType: ContractType | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 원문 전체를 한 문자열로. 숫자 · 링크 대조에 쓴다. */
export function sourceText(source: DraftSource): string {
  return [source.question, ...source.answers].join('\n');
}

function numbersIn(text: string): string[] {
  return text.match(/\d+/g) ?? [];
}

/**
 * 글에 나온 숫자가 전부 원문에도 있는가. "14일" 이 원문에 없는데 초안에 있으면 지어낸 것이다.
 * "정부24" 같은 이름 속 숫자도 원문에 없으면 걸린다. TODO(권섭): 이름 예외 목록을 둘지 결정.
 */
export function numbersFromSource(text: string, source: string): boolean {
  const known = new Set(numbersIn(source));
  return numbersIn(text).every((n) => known.has(n));
}

function clip(value: string, max: number): string {
  return [...value].slice(0, max).join('');
}

/** 문장 칸: 문자열이 아니거나, 원문에 없는 숫자가 섞이면 빈 칸으로 둔다. */
function text(value: unknown, max: number, source: string): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return numbersFromSource(trimmed, source) ? clip(trimmed, max) : '';
}

/** 링크 · 장소 · 전화: 원문에 글자 그대로 있을 때만 쓴다. AI 가 찾아 넣은 주소는 확인할 길이 없다. */
function verbatim(value: unknown, source: string): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '' || !source.includes(trimmed)) return null;
  return clip(trimmed, LIMITS.field);
}

function enumList<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is T => typeof v === 'string' && (allowed as readonly string[]).includes(v)))];
}

/**
 * AI 응답 → 양식에 채울 초안. 분류조차 못 고른 응답은 null(빈 양식으로 넘어간다).
 *
 * 기한은 원문에 그 숫자가 그대로 나올 때만 남긴다. "2주" → 14 같은 환산도 버린다 —
 * 법정 기한은 틀리면 과태료라 운영자가 직접 적게 한다.
 * TODO(권섭): 환산까지 허용할지, 기한은 아예 AI 가 제안하지 않게 할지 결정.
 */
export function sanitizeDraft(raw: unknown, source: DraftSource): TaskDraft | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.category !== 'string' || !(CATEGORIES as readonly string[]).includes(raw.category)) return null;
  const all = sourceText(source);

  const due = raw.dueOffsetDays;
  const dueOffsetDays =
    typeof due === 'number' && Number.isInteger(due) && due >= 0 && due <= DUE_OFFSET_MAX && numbersIn(all).includes(String(due))
      ? due
      : null;

  return {
    title: text(raw.title, LIMITS.title, all),
    why: text(raw.why, LIMITS.why, all),
    howTo: text(raw.howTo, LIMITS.howTo, all),
    category: raw.category as TaskCategory,
    dueOffsetDays,
    linkUrl: verbatim(raw.linkUrl, all),
    placeName: verbatim(raw.placeName, all),
    placeAddress: verbatim(raw.placeAddress, all),
    placePhone: verbatim(raw.placePhone, all),
    housingTypes: enumList(raw.housingTypes, HOUSING_TYPES),
    contractTypes: enumList(raw.contractTypes, CONTRACT_TYPES),
    // 차 · 반려동물 · 학생 조건은 원문에서 추론하기 어렵고, 잘못 켜면 필요한 사람에게 안 보인다. 운영자가 고른다.
    requiresCar: false,
    requiresPet: false,
    studentOnly: false,
  };
}
