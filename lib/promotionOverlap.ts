import { CONTRACT_LABEL, HOUSING_LABEL } from './labels';
import type { AdminTaskSummary, TaskConditions } from './types';

/*
 * 승격 화면의 "이미 보이는 할 일" 판정. 순수 로직만 둔다.
 *
 * 승격된 할 일은 목록에 더해지기만 하고, 기존 할 일과의 관계는 아무도 보지 않는다. 그래서
 * "기숙사 강아지 반입 금지"와 "반려견 동물등록하기"가 서로 모르는 문장으로 나란히 뜰 수 있다.
 * 동물등록은 사는 곳이 아니라 개를 가진 사람의 의무라 한쪽을 숨기면 안 된다 — 운영자가 둘을 같이 보고
 * 이어지는 문장으로 쓰게 하는 것이 목적이다. 자동으로 숨기거나 고치지 않는다.
 */

/** 두 목록 조건이 같은 사람을 가리킬 수 있는가. 빈 목록은 "조건 없음"이라 누구와도 겹친다. */
function listsMeet<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === 0 || b.length === 0 || a.some((v) => b.includes(v));
}

/**
 * 두 할 일을 동시에 보는 사람이 있을 수 있는가.
 * 차 · 강아지 · 학생은 한 사람이 다 가질 수 있어서 서로 막지 않는다. 주거 · 계약 형태만 엇갈릴 수 있다.
 */
export function canShareViewer(a: TaskConditions, b: TaskConditions): boolean {
  return listsMeet(a.housingTypes, b.housingTypes) && listsMeet(a.contractTypes, b.contractTypes);
}

/**
 * 둘 다 일부러 좁혀 둔 조건 중 겹치는 것. 화면에 "겹치는 조건: 기숙사 · 강아지"로 띄운다.
 * 한쪽이 "조건 없음"이면 겹친다고 보지 않는다 — 전입신고처럼 모두에게 보이는 일은 따로 묶는다.
 */
export function sharedConditions(a: TaskConditions, b: TaskConditions): string[] {
  const shared: string[] = [];
  for (const h of a.housingTypes) if (b.housingTypes.includes(h)) shared.push(HOUSING_LABEL[h]);
  for (const c of a.contractTypes) if (b.contractTypes.includes(c)) shared.push(CONTRACT_LABEL[c]);
  if (a.requiresCar && b.requiresCar) shared.push('차');
  if (a.requiresPet && b.requiresPet) shared.push('강아지');
  if (a.studentOnly && b.studentOnly) shared.push('학생');
  return shared;
}

export interface RelatedTask {
  task: AdminTaskSummary;
  shared: string[];
}

export interface TaskOverlap {
  /** 같은 좁은 조건을 가진 할 일. 말이 엇갈릴 수 있어 먼저 보여 준다. 겹치는 조건이 많은 순. */
  related: RelatedTask[];
  /** 같은 사람에게 보이지만 넓게(모두에게 등) 보이는 할 일. 접어서 보여 준다. */
  general: AdminTaskSummary[];
}

/** 새 할 일의 노출 조건 → 이미 있는 할 일 중 같은 사람에게 함께 보일 것. 아무와도 안 겹치는 할 일은 뺀다. */
export function findOverlaps(draft: TaskConditions, tasks: readonly AdminTaskSummary[]): TaskOverlap {
  const related: RelatedTask[] = [];
  const general: AdminTaskSummary[] = [];
  for (const task of tasks) {
    if (!canShareViewer(draft, task)) continue;
    const shared = sharedConditions(draft, task);
    if (shared.length > 0) related.push({ task, shared });
    else general.push(task);
  }
  related.sort((x, y) => y.shared.length - x.shared.length);
  return { related, general };
}
