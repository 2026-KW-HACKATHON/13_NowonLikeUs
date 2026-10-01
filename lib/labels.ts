/**
 * 화면에 찍히는 한글 라벨과 배지 문구.
 *
 * 목록 카드와 상세 화면이 각자 계산하면 같은 할 일이 두 화면에서 다르게 보인다.
 * (`lib/taskView.ts` 가 서버에서 같은 이유로 변환을 한곳에 모은 것과 같은 이유다.)
 *
 * 순수 함수만 둔다. `localStorage` 도 Prisma 도 쓰지 않으므로 양쪽에서 import 해도 된다.
 */

import type { ContractType, HousingType, MatchedTask, TaskCategory } from '@/lib/types';

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  ADMIN: '행정',
  WASTE: '쓰레기',
  HOUSING: '주거',
  LIFE: '생활',
};

export const HOUSING_LABEL: Record<HousingType, string> = {
  ONE_ROOM: '원룸',
  OFFICETEL: '오피스텔',
  DORM: '기숙사',
  APARTMENT: '아파트',
  VILLA: '빌라',
};

export const CONTRACT_LABEL: Record<ContractType, string> = {
  MONTHLY: '월세',
  JEONSE: '전세',
  DORM_FEE: '기숙사비',
  OWNED: '자가',
};

/** 배지 색을 고르는 톤. 빈 문자열은 기본 배지다. */
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
 * 히어로에 올릴 문구.
 *
 * 화면 맨 위 큰 숫자 자리라 짧아야 한다. "기한 16일 지남"은 84px 로 키우면 두 줄이 된다.
 * D+16 / D-DAY / D-3 세 형태로 통일하고, 설명은 아래 캡션에서 푼다.
 *
 * `daysLeft` 가 null 인 할 일은 히어로에 올리지 않는다 (`pickUrgent` 가 걸러 낸다).
 */
export function heroLabel(task: MatchedTask): {
  num: string;
  cap: string;
  cta: string;
  overdue: boolean;
} {
  const days = task.daysLeft ?? 0;
  if (days < 0) {
    const late = Math.abs(days);
    return { num: `D+${late}`, cap: task.title, cta: `기한이 ${late}일 지났습니다`, overdue: true };
  }
  if (days === 0) {
    return { num: 'D-DAY', cap: task.title, cta: '오늘까지입니다', overdue: true };
  }
  return { num: `D-${days}`, cap: task.title, cta: `${days}일 남았습니다`, overdue: false };
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

/**
 * 이사일을 "2026년 9월 1일"로.
 *
 * `Date` 로 파싱하지 않고 문자열을 그대로 쪼갠다. 'YYYY-MM-DD' 를 Date 에 넣으면
 * UTC 자정으로 읽혀서 한국 시간대에서는 전날로 밀린다.
 */
export function moveInLabel(moveInDate: string): string {
  const [year, month, day] = moveInDate.split('-');
  if (!year || !month || !day) return moveInDate;
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}
