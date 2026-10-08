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
    // 버린다는 말 대신 자연스럽게 쓰는 폐기 표현
    ['ONE_ROOM', '소파 치우기'], ['ONE_ROOM', '침대 없애기'], ['VILLA', '책상 내다 놓기'], ['OFFICETEL', '쇼파 치우려면'],
    ['APARTMENT', '옷장 회수 신청'], ['APARTMENT', '매트리스 없애고 싶어요'],
  ] as const)('%s 프로필에서 가구 이름으로 대형폐기물 카드를 찾는다: %s', (housingType, query) => {
    expect(titles(housingType, query)[0]).toBe('큰 가구 버리는 방법 알아두기 (대형폐기물)');
  });

  it.each([['ONE_ROOM', '소파를 치우려면'], ['VILLA', '소파 처리하려면'], ['APARTMENT', '침대는 없애고 싶어요']] as const)(
    '%s 프로필에서 치우기·없애기·처리가 가구 바로 뒤에 오면 버리는 질문으로 본다: %s', (housingType, query) => {
      expect(titles(housingType, query)[0]).toBe('큰 가구 버리는 방법 알아두기 (대형폐기물)');
    },
  );

  // 치우기·없애기·처리는 청소에도 쓰여, 가구·가전과 사이에 다른 말이 끼면 버리는 질문으로 보지 않는다.
  it.each(['ONE_ROOM', 'VILLA', 'APARTMENT', 'OFFICETEL', 'DORM'] as const)('%s 프로필에서 청소 문맥은 폐기 카드를 찾지 않는다', (housingType) => {
    for (const query of ['소파 얼룩 없애기', '소파 먼지 치우기', '책상 표면 처리 방법', '전자레인지 냄새 없애기']) {
      expect(titles(housingType, query), query).toEqual([]);
    }
  });

  it.each(['ONE_ROOM', 'VILLA', 'APARTMENT', 'OFFICETEL'] as const)('%s 프로필에서 쓰레기봉투는 종량제봉투 카드를 먼저 찾는다', (housingType) => {
    for (const query of ['쓰레기봉투 어디서 사요?', '쓰레기 봉투 사는 곳', '쓰레기봉투 파는 곳']) {
      expect(titles(housingType, query)[0], query).toBe('종량제봉투 파는 곳 알아두기');
    }
  });

  // 가구 카드는 버리는 방법만 안내하므로, 버리는 질문이 아닐 때는 가구 이름을 넓히지 않는다.
  it.each(['소파 청소 업체', '책상 조립 방법', '침대 추천', '소파', '옷장 정리 방법'])('버리는 질문이 아니면 가구 이름으로 대형폐기물 카드를 찾지 않는다: %s', (query) => {
    expect(titles('ONE_ROOM', query)).not.toContain('큰 가구 버리는 방법 알아두기 (대형폐기물)');
  });

  // 검증된 대형 폐가전 카드가 시드에 생기기 전까지는 처리 방법이 다른 카드를 안내하지 않고 빈 결과로 둔다.
  const largeApplianceQueries = [
    '냉장고 버리기', '냉장고 버리는 방법', '냉장고 버리는 방법 알려주세요', '세탁기는 어떻게 버려요?', '에어컨 버리는 날',
    '텔레비전 버리기', 'TV 버리려면', '김치냉장고 폐기', '대형 가전 버리기', '대형가전 버리는 방법', '대형 폐가전 수거 신청',
    'TV 재활용 어떻게 해요?', '냉장고 재활용', '대형 가전 처리 방법', '세탁기 버림', '에어컨 처리하려면',
    // 폐기 표현이 없거나 다른 말로 물어도, 표기가 달라도 막는다.
    '냉장고 어떻게 해요?', '이사 가는데 세탁기는?', 'TV 없애고 싶어요', '텔레비젼 내다 놓기', '티브이 버리기', '냉동고 버리기',
    '식기세척기 버리는 법', '큰 가전 버리기', '김치 냉장고 정리', '냉장고 수거 업체', '에어컨 철거', '정수기 반납',
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
    // 카드에 소형 가전으로 적힌 품목은 그 카드로 잇는다.
    ['ONE_ROOM', '전자레인지 버리기', '작은 가전 버리는 요일 알아두기'],
    ['APARTMENT', '드라이기 버리려면', '작은 가전은 관리사무소에 먼저 물어보기'],
    ['ONE_ROOM', '전자레인지 치우기', '작은 가전 버리는 요일 알아두기'],
    ['VILLA', '드라이기 없애려면', '작은 가전 버리는 요일 알아두기'],
    ['APARTMENT', '전자레인지 회수', '작은 가전은 관리사무소에 먼저 물어보기'],
    ['ONE_ROOM', '전자레인지 내다 놓는 날', '작은 가전 버리는 요일 알아두기'],
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
    expect(keywordSearch(items, '소파 버리기 전입신고', 2).map((item) => item.title)).toEqual(['전입신고 하기', '가구 대형폐기물 안내']);
  });

  it.each([
    ['APARTMENT', '분리배출', ['우리 단지 분리배출 요일 확인하기']],
    ['ONE_ROOM', '반려견 등록', ['반려견 동물등록하기']],
    ['ONE_ROOM', '전입신고', ['전입신고 하기', '확정일자 받기']],
  ] as const)('%s 프로필에서 동의어가 없는 질문은 결과가 그대로다: %s', (housingType, query, expected) => {
    expect(titles(housingType, query)).toEqual(expected);
  });
});
