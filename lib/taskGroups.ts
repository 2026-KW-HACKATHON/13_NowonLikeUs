/**
 * 할 일 목록을 화면 구조에 맞게 재배치한다.
 *
 * API 는 기한순 한 줄로 내려준다. 화면은 "가장 급한 것 하나 + 카테고리별 묶음"이라
 * 그 변환을 여기 모아 둔다. 순수 함수라 단위 테스트 대상이다.
 */

import type { MatchedTask, TaskCategory } from '@/lib/types';

/** 화면에 나오는 순서. 급한 순이 아니라 행정 → 주거 → 쓰레기 → 생활 고정이다. */
export const CATEGORY_ORDER: TaskCategory[] = ['ADMIN', 'HOUSING', 'WASTE', 'LIFE'];

export interface CategoryGroup {
  category: TaskCategory;
  tasks: MatchedTask[];
}

/**
 * 히어로에 올릴 할 일 하나.
 *
 * 기한이 있는 것 중 `daysLeft` 가 가장 작은 것 — 가장 많이 지났거나 가장 임박한 것이다.
 * 기한이 없는 할 일은 후보가 아니다. 전부 기한이 없으면 null 이고, 그럴 땐 히어로를 띄우지 않는다.
 */
export function pickUrgent(tasks: MatchedTask[]): MatchedTask | null {
  let urgent: MatchedTask | null = null;
  for (const task of tasks) {
    if (task.daysLeft === null) continue;
    if (urgent === null || task.daysLeft < urgent.daysLeft!) urgent = task;
  }
  return urgent;
}

/**
 * 카테고리별로 묶는다.
 *
 * 비어 있는 카테고리는 내보내지 않는다. 할 일이 3건일 때 빈 제목 4개가 뜨면 더 허전해 보인다.
 * 묶음 안의 순서는 API 가 준 기한순을 그대로 유지한다.
 */
export function groupByCategory(tasks: MatchedTask[]): CategoryGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    tasks: tasks.filter((task) => task.category === category),
  })).filter((group) => group.tasks.length > 0);
}
