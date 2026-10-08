import { describe, expect, it } from 'vitest';

import { keywordSearch } from '@/lib/search';
import { seedTasks } from '@/prisma/seed-data';

const seeds = seedTasks.map(({ title, why, howTo }) => ({ title, why, howTo }));
const titles = (query: string) => keywordSearch(seeds, query).map((item) => item.title);

describe('keywordSearch 동의어 (실제 시드)', () => {
  it.each(['소파 버리기', '침대를 버리려면', '매트리스 버리기'])('가구 이름으로 대형폐기물 카드를 찾는다: %s', (query) => {
    expect(titles(query)[0]).toBe('큰 가구 버리는 방법 알아두기 (대형폐기물)');
  });

  it.each(['냉장고 버리기', '세탁기는 어떻게 버려요?'])('큰 가전 이름으로 가전·대형폐기물 카드를 찾는다: %s', (query) => {
    expect(titles(query)).toEqual([
      '작은 가전 버리는 요일 알아두기',
      '작은 가전은 관리사무소에 먼저 물어보기',
      '큰 가구 버리는 방법 알아두기 (대형폐기물)',
    ]);
  });

  it.each(['분리수거', '분리수거 언제 해요?'])('분리수거는 재활용·분리배출 카드를 먼저 찾는다: %s', (query) => {
    expect(titles(query).slice(0, 2)).toEqual(['재활용 버리는 요일 알아두기', '우리 단지 분리배출 요일 확인하기']);
  });

  it('카드에 분리수거라고 쓰인 기숙사 카드도 계속 찾는다', () => {
    expect(titles('빛솔재 분리수거')[0]).toBe('빛솔재 쓰레기 버리는 곳 알아두기');
  });

  it.each(['강아지 등록', '애완견 등록하려면'])('강아지는 반려견 카드를 찾는다: %s', (query) => {
    expect(titles(query)).toEqual(['반려견 동물등록하기']);
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
    ['분리배출', ['우리 단지 분리배출 요일 확인하기']],
    ['반려견 등록', ['반려견 동물등록하기']],
    ['전입신고', ['전입신고 하기', '빛솔재 거주증명서 받아서 전입신고하기', '확정일자 받기']],
  ])('동의어가 없는 질문은 결과가 그대로다: %s', (query, expected) => {
    expect(titles(query)).toEqual(expected);
  });
});
