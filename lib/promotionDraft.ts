import { DUE_OFFSET_MAX } from './promotion';
import type { ContractType, HousingType, TaskCategory, TaskDraft } from './types';

/*
 * 승격 AI 초안(docs/승격시스템흐름.md ⑤)의 입력 정리와 출력 검증. 순수 로직만 둔다(서버 코드 import 금지).
 *
 * 초안은 제안일 뿐이다. 운영자가 양식에서 고치고 출처를 적어야 발행된다(⑥).
 * AI가 답변의 사실을 자르거나 다른 문장으로 바꾸면 의미가 달라질 수 있어서 title · why · howTo도
 * 주민 답변의 완전한 원문 문장만 허용한다. 나머지 값도 원문과 직접 대조되지 않으면 비운다.
 * 질문은 AI 가 맥락을 잡는 데만 쓰고 대조 근거로는 쓰지 않는다. 질문은 근거가 아니라 물음이다.
 */

const CATEGORIES: readonly TaskCategory[] = ['ADMIN', 'WASTE', 'HOUSING', 'LIFE'];

/** 양식 칸 길이와 맞춘다(lib/promotion.ts). 넘치는 원문은 중간을 자르지 않고 비운다. */
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

function urlsIn(text: string): string[] {
  return text.match(/(?:https?:\/\/|www\.)[^\s)]+/gi) ?? [];
}

function phonesIn(text: string): string[] {
  return [...text.matchAll(/(?:^|\D)(\d{2,4}[-\s]\d{3,4}[-\s]\d{4})(?=\D|$)/g)]
    .map((match) => match[1]);
}

/**
 * 이사일 기준 기한인가. 같은 문장 안에 "이사" · "전입" 과 "N일 안/이내/까지"가 함께 있어야 한다.
 * "3일마다 수거" 처럼 이사일과 상관없는 숫자, "2주" → 14 같은 환산은 버린다 — 법정 기한은 틀리면 과태료다.
 */
export function isMoveInDeadline(days: number, answers: string[]): boolean {
  const deadline = `(?<!\\d)${days}\\s*일\\s*(?:안(?:에)?|이내(?:에)?|내로|까지)`;
  const moveFirst = new RegExp(
    `(?:이사(?:일)?|전입(?:신고)?)(?:은|는|을|를)?\\s*(?:한\\s*(?:날|뒤|후)|하고|후|부터|기준|로부터)?\\s*${deadline}`,
  );
  const deadlineFirst = new RegExp(`${deadline}\\s*(?:이사|전입(?:신고)?)`);
  const negated = /아니|아닙|아닌|아님|않|없|안\s*(?:해|하|되|돼)|지\s*마|말(?:라|아|고)|금지|제외|면제|불필요/;
  return answers.some((answer) =>
    answer.split(/[.!?\n]/).some((sentence) =>
      !negated.test(sentence) && (moveFirst.test(sentence) || deadlineFirst.test(sentence)),
    ),
  );
}

function isWholeSentence(value: string, answer: string): boolean {
  const chars = [...value];
  const hasInternalSentenceEnd = chars.some((char, index) => {
    if (!'.!?'.includes(char) || chars.slice(index + 1).join('').trim() === '') return false;
    if (char === '.' && /[A-Za-z0-9]/.test(chars[index - 1] ?? '') && /[A-Za-z0-9]/.test(chars[index + 1] ?? '')) {
      return false; // URL의 도메인·경로 안 마침표는 문장 경계가 아니다.
    }
    return true;
  });
  if (hasInternalSentenceEnd) return false;

  return answer
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .some((sentence) => value === sentence || value === sentence.replace(/[.!?]$/, '').trim());
}

/** 문장 칸: 주민 답변의 완전한 한 문장만 쓴다. AI가 자르거나 바꾸거나 합친 문장은 비운다. */
function text(value: unknown, max: number, answers: string[]): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if ([...trimmed].length > max) return '';
  return trimmed !== '' && answers.some((answer) => isWholeSentence(trimmed, answer)) ? trimmed : '';
}

/** 링크 · 장소 · 전화: 답변에 글자 그대로 있을 때만 쓴다. AI 가 찾아 넣은 주소는 확인할 길이 없다. */
function verbatim(value: unknown, answers: string[], exactValues?: string[]): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const found = exactValues ? exactValues.includes(trimmed) : answers.some((answer) => answer.includes(trimmed));
  if (trimmed === '' || !found || [...trimmed].length > LIMITS.field) return null;
  return trimmed;
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
  const due = raw.dueOffsetDays;
  const dueOffsetDays =
    typeof due === 'number' && Number.isInteger(due) && due >= 0 && due <= DUE_OFFSET_MAX && isMoveInDeadline(due, source.answers)
      ? due
      : null;

  return {
    title: text(raw.title, LIMITS.title, source.answers),
    why: text(raw.why, LIMITS.why, source.answers),
    howTo: text(raw.howTo, LIMITS.howTo, source.answers),
    category: raw.category as TaskCategory,
    dueOffsetDays,
    linkUrl: verbatim(raw.linkUrl, source.answers, source.answers.flatMap(urlsIn)),
    placeName: verbatim(raw.placeName, source.answers),
    placeAddress: verbatim(raw.placeAddress, source.answers),
    placePhone: verbatim(raw.placePhone, source.answers, source.answers.flatMap(phonesIn)),
    housingTypes: withinAsker(raw.housingTypes, source.askerHousingType),
    contractTypes: withinAsker(raw.contractTypes, source.askerContractType),
    // 차 · 반려동물 · 학생 조건은 질문자 상황에 없어 근거가 없고, 잘못 켜면 필요한 사람에게 안 보인다. 운영자가 고른다.
    requiresCar: false,
    requiresPet: false,
    studentOnly: false,
  };
}
