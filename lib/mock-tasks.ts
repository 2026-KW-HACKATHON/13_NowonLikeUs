/**
 * 임시 목 데이터 — 화면 개발과 9/28 시연용.
 *
 * `/api/tasks/match` 가 붙으면 이 파일은 통째로 지운다.
 * 내용은 `prisma/seed-data.ts` 의 시드 3건과 같고, 필터는 `lib/matching.ts` 가 할 일을
 * 가장 단순한 형태로 흉내낸 것이다. 조건 판정의 정본은 `lib/matching.ts` 다.
 */

import { daysUntilDue, isOverdue, isStale } from './dday';
import type { MatchedTask, Profile, TaskConditions } from './types';

type MockTask = Omit<MatchedTask, 'daysLeft' | 'overdue' | 'stale'> &
  TaskConditions & { dueOffsetDays: number | null };

const VERIFIED_AT = '2026-09-24T00:00:00.000Z';

const NO_CONDITIONS: TaskConditions = {
  housingTypes: [],
  contractTypes: [],
  requiresCar: false,
  requiresPet: false,
  studentOnly: false,
};

const TASKS: MockTask[] = [
  {
    ...NO_CONDITIONS,
    id: 'seed-jeonipsingo',
    title: '전입신고 하기',
    why: '이사 후 14일이 지나면 과태료가 부과되고, 확정일자와 함께 해두지 않으면 보증금을 보호받지 못할 수 있습니다.',
    howTo:
      '세대주가 이사한 날부터 14일 이내에 새 주소지의 시장·군수·구청장에게 신고합니다. ' +
      '주민센터를 직접 방문하거나 정부24에서 온라인으로 신고할 수 있습니다.',
    category: 'ADMIN',
    linkUrl: 'https://www.gov.kr/portal/onestopSvc/transferReport',
    placeName: null,
    placeAddress: null,
    placePhone: null,
    verifiedAt: VERIFIED_AT,
    dueOffsetDays: 14,
  },
  {
    ...NO_CONDITIONS,
    contractTypes: ['MONTHLY', 'JEONSE'],
    id: 'seed-hwakjeongilja',
    title: '확정일자 받기',
    why:
      '임차보증금에 대한 우선변제권을 얻기 위해 필요합니다. ' +
      '받아두지 않으면 집이 경매에 넘어갈 때 보증금을 돌려받는 순위에서 밀립니다.',
    howTo:
      '전입신고를 하러 갈 때 임대차계약서 원본을 함께 가져가 확정일자를 받습니다. ' +
      '전입신고와 같은 창구에서 한 번에 처리됩니다.',
    category: 'HOUSING',
    linkUrl: null,
    placeName: null,
    placeAddress: null,
    placePhone: null,
    verifiedAt: VERIFIED_AT,
    dueOffsetDays: 14,
  },
  {
    ...NO_CONDITIONS,
    contractTypes: ['MONTHLY', 'JEONSE'],
    id: 'seed-jeonwolse',
    title: '전월세 신고하기 (해당하는 계약만)',
    why: '신고 의무 대상인데 하지 않으면 과태료가 부과될 수 있습니다.',
    howTo:
      '보증금 6천만 원을 초과하거나 월세가 30만 원을 초과하는 계약은 ' +
      '계약일로부터 30일 이내에 신고해야 합니다. 이 기준에 해당하지 않으면 신고 대상이 아닙니다.',
    category: 'HOUSING',
    linkUrl: null,
    placeName: null,
    placeAddress: null,
    placePhone: null,
    verifiedAt: VERIFIED_AT,
    // 이 신고의 기한은 '계약일' 기준 30일이라 '이사일' 기준으로 환산할 수 없다.
    dueOffsetDays: null,
  },
];

function matches(conditions: TaskConditions, profile: Profile): boolean {
  if (conditions.housingTypes.length > 0 && !conditions.housingTypes.includes(profile.housingType)) return false;
  if (conditions.contractTypes.length > 0 && !conditions.contractTypes.includes(profile.contractType)) return false;
  if (conditions.requiresCar && !profile.hasCar) return false;
  if (conditions.requiresPet && !profile.hasPet) return false;
  if (conditions.studentOnly && !profile.isStudent) return false;
  return true;
}

/** 프로필에 해당하는 할 일만, 기한 임박한 순으로. 기한 없는 항목은 뒤로. */
export function mockMatch(profile: Profile, today = new Date()): MatchedTask[] {
  return TASKS.filter((task) => matches(task, profile))
    .map(({ dueOffsetDays, housingTypes, contractTypes, requiresCar, requiresPet, studentOnly, ...rest }) => {
      const daysLeft = daysUntilDue(profile.moveInDate, dueOffsetDays, today);
      return {
        ...rest,
        daysLeft,
        overdue: isOverdue(daysLeft),
        stale: isStale(new Date(rest.verifiedAt), today),
      };
    })
    .sort((a, b) => {
      if (a.daysLeft === null && b.daysLeft === null) return 0;
      if (a.daysLeft === null) return 1;
      if (b.daysLeft === null) return -1;
      return a.daysLeft - b.daysLeft;
    });
}
