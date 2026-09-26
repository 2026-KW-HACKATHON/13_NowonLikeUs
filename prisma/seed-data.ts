import type { Prisma } from '@prisma/client';

export type SeedTask = Omit<Prisma.TaskCreateInput, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 확인된 항목만 넣는다. 확인되지 않은 값은 추정으로 채우지 않는다.
 * 새 항목을 추가할 때는 sourceNote에 출처와 확인 경로를, verifiedAt에 확인 날짜를 반드시 적는다.
 */
export const seedTasks: SeedTask[] = [
  {
    title: '전입신고 하기',
    why: '이사 후 14일이 지나면 과태료가 부과되고, 확정일자와 함께 해두지 않으면 보증금을 보호받지 못할 수 있습니다.',
    dueOffsetDays: 14,
    howTo:
      '세대주가 이사한 날부터 14일 이내에 새 주소지의 시장·군수·구청장에게 신고합니다. ' +
      '주민센터를 직접 방문하거나 정부24에서 온라인으로 신고할 수 있습니다.',
    linkUrl: 'https://www.gov.kr/portal/onestopSvc/transferReport',
    category: 'ADMIN',
    housingTypes: [],
    contractTypes: [],
    sourceNote: '찾기쉬운 생활법령정보 「주택임대차 — 이사 후의 체크리스트」 / 정부24 전입신고 원스톱 서비스',
    verifiedAt: new Date('2026-09-24T00:00:00Z'),
  },
  {
    title: '확정일자 받기',
    why:
      '임차보증금에 대한 우선변제권을 얻기 위해 필요합니다. ' +
      '받아두지 않으면 집이 경매에 넘어갈 때 보증금을 돌려받는 순위에서 밀립니다.',
    dueOffsetDays: 14,
    howTo:
      '전입신고를 하러 갈 때 임대차계약서 원본을 함께 가져가 확정일자를 받습니다. ' +
      '전입신고와 같은 창구에서 한 번에 처리됩니다.',
    linkUrl: null,
    category: 'HOUSING',
    housingTypes: [],
    contractTypes: ['MONTHLY', 'JEONSE'],
    sourceNote: '찾기쉬운 생활법령정보 「주택임대차 — 이사 후의 체크리스트」',
    verifiedAt: new Date('2026-09-24T00:00:00Z'),
  },
  {
    title: '전월세 신고하기 (해당하는 계약만)',
    // dueOffsetDays를 쓰지 않는 이유: 이 신고의 기한은 '계약일'로부터 30일인데
    // dueOffsetDays는 '이사일' 기준이다. 환산하면 틀린 날짜가 나오므로 비워두고 원문을 적는다.
    dueOffsetDays: null,
    why: '신고 의무 대상인데 하지 않으면 과태료가 부과될 수 있습니다.',
    howTo:
      '보증금 6천만 원을 초과하거나 월세가 30만 원을 초과하는 계약은 ' +
      '계약일로부터 30일 이내에 신고해야 합니다. 이 기준에 해당하지 않으면 신고 대상이 아닙니다. ' +
      '주민센터 방문 또는 부동산거래관리시스템에서 신고합니다.',
    linkUrl: null,
    category: 'HOUSING',
    housingTypes: [],
    contractTypes: ['MONTHLY', 'JEONSE'],
    sourceNote: '주택 임대차 신고 기준(보증금 6천만 원 초과 또는 월세 30만 원 초과, 계약일부터 30일) — 조사 시 확인',
    verifiedAt: new Date('2026-09-24T00:00:00Z'),
  },
];