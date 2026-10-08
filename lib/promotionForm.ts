import { DUE_OFFSET_MAX, validatePromoteRequest } from './promotion';
import type { ContractType, HousingType, PromoteRequest, TaskCategory, TaskDraft } from './types';

/*
 * 운영자 승격 화면(/admin/promotions)의 양식 상태와 요청 변환.
 * 최종 판정은 서버와 같은 `validatePromoteRequest` 를 그대로 쓴다 — 규칙을 두 곳에 두지 않는다.
 */

/** 입력칸은 전부 문자열로 들고 있다가 보낼 때 바꾼다. 숫자 칸을 비우면 "기한 없음"이다. */
export interface PromoteForm {
  title: string;
  why: string;
  howTo: string;
  category: TaskCategory | '';
  dueOffsetDays: string;
  linkUrl: string;
  placeName: string;
  placeAddress: string;
  placePhone: string;
  housingTypes: HousingType[];
  contractTypes: ContractType[];
  requiresCar: boolean;
  requiresPet: boolean;
  studentOnly: boolean;
  sourceNote: string;
}

export function emptyForm(): PromoteForm {
  return {
    title: '', why: '', howTo: '', category: '', dueOffsetDays: '',
    linkUrl: '', placeName: '', placeAddress: '', placePhone: '',
    housingTypes: [], contractTypes: [], requiresCar: false, requiresPet: false, studentOnly: false,
    // 출처는 AI 초안이 있어도 비워 둔다. 운영자가 무엇으로 확인했는지 직접 써야 의미가 있다.
    sourceNote: '',
  };
}

/** AI 초안을 양식에 채운다. 출처는 채우지 않는다. */
export function formFromDraft(draft: TaskDraft): PromoteForm {
  return {
    ...emptyForm(),
    title: draft.title,
    why: draft.why,
    howTo: draft.howTo,
    category: draft.category,
    dueOffsetDays: draft.dueOffsetDays === null ? '' : String(draft.dueOffsetDays),
    linkUrl: draft.linkUrl ?? '',
    placeName: draft.placeName ?? '',
    placeAddress: draft.placeAddress ?? '',
    placePhone: draft.placePhone ?? '',
    housingTypes: [...draft.housingTypes],
    contractTypes: [...draft.contractTypes],
    requiresCar: draft.requiresCar,
    requiresPet: draft.requiresPet,
    studentOnly: draft.studentOnly,
  };
}

/**
 * 양식 → 승격 요청. 통과하면 서버에 보낼 값, 아니면 화면에 띄울 문장.
 *
 * 기한 칸은 숫자만 받는다. "14일", "2주" 처럼 글자가 섞이면 숫자로 억지로 바꾸지 않고 거절한다 —
 * parseInt('14일') 은 14 가 되지만, 운영자가 무엇을 뜻했는지 화면이 추측하면 안 된다.
 */
export function toPromoteRequest(
  form: PromoteForm,
  questionId: string,
): { ok: true; value: PromoteRequest } | { ok: false; error: string } {
  if (form.category === '') return { ok: false, error: '분류를 골라 주세요.' };

  const dueText = form.dueOffsetDays.trim();
  if (dueText !== '' && !/^\d+$/.test(dueText)) {
    return { ok: false, error: `기한은 비워 두거나 0~${DUE_OFFSET_MAX} 사이의 숫자로만 입력해 주세요.` };
  }

  const request = {
    questionId,
    sourceNote: form.sourceNote,
    task: {
      title: form.title,
      why: form.why,
      howTo: form.howTo,
      category: form.category,
      dueOffsetDays: dueText === '' ? null : Number(dueText),
      linkUrl: form.linkUrl,
      placeName: form.placeName,
      placeAddress: form.placeAddress,
      placePhone: form.placePhone,
      housingTypes: form.housingTypes,
      contractTypes: form.contractTypes,
      requiresCar: form.requiresCar,
      requiresPet: form.requiresPet,
      studentOnly: form.studentOnly,
    },
  };
  return validatePromoteRequest(request);
}

/** 목록에서 하나를 넣고 빼는 체크박스용 */
export function toggle<T>(list: T[], value: T, on: boolean): T[] {
  const without = list.filter((v) => v !== value);
  return on ? [...without, value] : without;
}

/**
 * 노출 조건 요약. 발행하면 누구 목록에 뜨는지 운영자가 한눈에 보게 한다.
 * 조건이 하나도 없으면 "모든 사람" — 의도한 게 맞는지 다시 보게 하려고 따로 표시한다.
 */
export function audienceSummary(
  form: Pick<PromoteForm, 'housingTypes' | 'contractTypes' | 'requiresCar' | 'requiresPet' | 'studentOnly'>,
  labels: { housing: Record<HousingType, string>; contract: Record<ContractType, string> },
): string {
  const parts: string[] = [];
  if (form.housingTypes.length > 0) parts.push(form.housingTypes.map((h) => labels.housing[h]).join(' · '));
  if (form.contractTypes.length > 0) parts.push(form.contractTypes.map((c) => labels.contract[c]).join(' · '));
  if (form.requiresCar) parts.push('차 있음');
  if (form.requiresPet) parts.push('반려동물 있음');
  if (form.studentOnly) parts.push('학생');
  return parts.length === 0 ? '모든 사람' : parts.join(', ');
}
