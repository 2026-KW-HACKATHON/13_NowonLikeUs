import { describe, expect, it } from 'vitest';

import { matchesProfile } from '@/lib/matching';
import { keywordSearch } from '@/lib/search';
import type { HousingType, Profile, TaskConditions } from '@/lib/types';
import { seedTasks } from '@/prisma/seed-data';

const seeds = seedTasks.map((task) => ({
  title: task.title,
  why: task.why,
  howTo: task.howTo,
  housingTypes: (task.housingTypes ?? []) as TaskConditions['housingTypes'],
  contractTypes: (task.contractTypes ?? []) as TaskConditions['contractTypes'],
  requiresCar: task.requiresCar ?? false,
  requiresPet: task.requiresPet ?? false,
  studentOnly: task.studentOnly ?? false,
}));

const profileOf = (housingType: HousingType): Profile => ({
  zone: '', housingType, contractType: 'MONTHLY', moveInDate: '2026-10-01', hasCar: true, hasPet: true, isStudent: true,
});

/** /api/ask 와 같이 프로필에 맞는 후보를 먼저 거른 뒤 검색한다. */
const titles = (housingType: HousingType, query: string) => keywordSearch(
  seeds.filter((task) => matchesProfile(task, profileOf(housingType))), query,
).map((item) => item.title);

describe('keywordSearch 동의어 (실제 시드 · 프로필 후보)', () => {
  it.each([
    ['ONE_ROOM', '재활용 버리는 요일 알아두기'],
    ['APARTMENT', '우리 단지 분리배출 요일 확인하기'],
    ['DORM', '빛솔재 쓰레기 버리는 곳 알아두기'],
  ] as const)('%s 프로필의 분리수거는 그 주거형태 카드를 먼저 찾는다', (housingType, expected) => {
    expect(titles(housingType, '분리수거')[0]).toBe(expected);
    expect(titles(housingType, '분리수거 언제 해요?')[0]).toBe(expected);
  });

  it.each([
    ['ONE_ROOM', '소파 버리기'], ['ONE_ROOM', '침대를 버리려면'], ['APARTMENT', '매트리스 버리기'],
  ] as const)('%s 프로필에서 가구 이름으로 대형폐기물 카드를 찾는다: %s', (housingType, query) => {
    expect(titles(housingType, query)[0]).toBe('큰 가구 버리는 방법 알아두기 (대형폐기물)');
  });

  // 검증된 대형 폐가전 카드가 시드에 생기기 전까지는 처리 방법이 다른 카드를 안내하지 않고 빈 결과로 둔다.
  const largeApplianceQueries = [
    '냉장고 버리기', '냉장고 버리는 방법', '냉장고 버리는 방법 알려주세요', '세탁기는 어떻게 버려요?', '에어컨 버리는 날',
    '텔레비전 버리기', 'TV 버리려면', '김치냉장고 폐기', '대형 가전 버리기', '대형가전 버리는 방법', '대형 폐가전 수거 신청',
  ];

  it.each(['ONE_ROOM', 'VILLA', 'APARTMENT', 'OFFICETEL', 'DORM'] as const)('%s 프로필에서 대형 가전 폐기 질문은 빈 결과다', (housingType) => {
    for (const query of largeApplianceQueries) {
      expect(titles(housingType, query), query).toEqual([]);
    }
  });

  it('프로필 없이 시드 전체를 검색해도 대형 가전 폐기 질문은 빈 결과다', () => {
    for (const query of largeApplianceQueries) {
      expect(keywordSearch(seeds, query), query).toEqual([]);
    }
  });

  it.each([
    ['ONE_ROOM', '작은 가전 버리기', '작은 가전 버리는 요일 알아두기'],
    ['APARTMENT', '드라이기 같은 작은 가전 버리는 곳', '작은 가전은 관리사무소에 먼저 물어보기'],
  ] as const)('%s 프로필의 작은 가전 질문은 계속 작은 가전 카드를 찾는다: %s', (housingType, query, expected) => {
    expect(titles(housingType, query)[0]).toBe(expected);
  });

  it.each(['강아지 등록', '애완견 등록하려면'])('강아지는 반려견 카드를 찾는다: %s', (query) => {
    expect(titles('ONE_ROOM', query)).toEqual(['반려견 동물등록하기']);
  });

  it('동의어로 넓힌 말은 원래 키워드 하나로 센다', () => {
    const items = [
      { title: '전입신고 하기', why: '', howTo: '' },
      { title: '가구 대형폐기물 안내', why: '', howTo: '' },
    ];
    // 소파가 가구·대형폐기물 둘 다에 걸려도 두 키워드가 걸린 것으로 치지 않는다.
    expect(keywordSearch(items, '소파 전입신고', 2).map((item) => item.title)).toEqual(['전입신고 하기', '가구 대형폐기물 안내']);
  });

  it.each([
    ['APARTMENT', '분리배출', ['우리 단지 분리배출 요일 확인하기']],
    ['ONE_ROOM', '반려견 등록', ['반려견 동물등록하기']],
    ['ONE_ROOM', '전입신고', ['전입신고 하기', '확정일자 받기']],
  ] as const)('%s 프로필에서 동의어가 없는 질문은 결과가 그대로다: %s', (housingType, query, expected) => {
    expect(titles(housingType, query)).toEqual(expected);
  });
});
