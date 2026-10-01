/**
 * 화면에 찍히는 한글 라벨과 배지 문구.
 *
 * 목록 카드와 상세 화면이 각자 계산하면 같은 할 일이 두 화면에서 다르게 보인다.
 * (`lib/taskView.ts` 가 서버에서 같은 이유로 변환을 한곳에 모은 것과 같은 이유다.)
 *
 * 순수 함수만 둔다. `localStorage` 도 Prisma 도 쓰지 않으므로 양쪽에서 import 해도 된다.
 */

import type { MatchedTask, TaskCategory } from '@/lib/types';

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  ADMIN: '행정',
  WASTE: '쓰레기',
  HOUSING: '주거',
  LIFE: '생활',
};

/** 배지 색을 고르는 톤. 빈 문자열은 기본(초록) 배지다. */
export type DueTone = '' | 'overdue' | 'none';

/**
 * 기한 배지 문구.
 *
 * `daysLeft` 가 null 이면 기한이 없는 할 일이다. 0 은 오늘까지, 음수는 이미 지난 것이다.
 * 0 을 "0일 남음"으로 찍으면 안 해도 되는 것처럼 읽힌다.
 */
export function dueLabel(task: MatchedTask): { text: string; tone: DueTone } {
  if (task.daysLeft === null) return { text: '기한 없음', tone: 'none' };
  if (task.daysLeft < 0) return { text: `기한 ${Math.abs(task.daysLeft)}일 지남`, tone: 'overdue' };
  if (task.daysLeft === 0) return { text: '오늘까지', tone: 'overdue' };
  return { text: `${task.daysLeft}일 남음`, tone: '' };
}

/**
 * 마지막 확인일을 "○년 ○월 기준"으로.
 *
 * `verifiedAt` 은 UTC 자정으로 저장되므로 getUTC* 로 읽는다.
 * 로컬 시간으로 읽으면 한국에서 하루 밀려서 1월 1일이 작년 12월로 찍힌다.
 */
export function asOfLabel(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 기준`;
}
