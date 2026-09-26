import { describe, expect, it } from 'vitest';

import { keywordSearch } from '@/lib/search';

const items = [
  { id: '1', title: '전입신고 하기', why: '과태료가 부과됩니다', howTo: '주민센터 방문' },
  { id: '2', title: '확정일자 받기', why: '보증금 보호', howTo: '임대차계약서 지참' },
  { id: '3', title: '음식물 쓰레기 버리기', why: '과태료', howTo: '전용 봉투 사용' },
];

describe('keywordSearch', () => {
  it('제목에 포함된 말로 찾는다', () => {
    expect(keywordSearch(items, '전입신고').map((item) => item.id)).toEqual(['1']);
  });

  it('절차 설명에 포함된 말로도 찾는다', () => {
    expect(keywordSearch(items, '임대차계약서').map((item) => item.id)).toEqual(['2']);
  });

  it('여러 낱말 중 하나라도 걸리면 찾는다', () => {
    expect(keywordSearch(items, '쓰레기 봉투 주차장').map((item) => item.id)).toEqual(['3']);
  });

  it('일치하는 서로 다른 낱말이 많은 항목이 먼저 온다', () => {
    expect(keywordSearch(items, '과태료 봉투').map((item) => item.id)).toEqual(['3', '1']);
  });

  it('일치하는 항목이 없으면 빈 배열이다', () => {
    expect(keywordSearch(items, '주차장')).toEqual([]);
  });

  it('limit만큼만 반환한다', () => {
    expect(keywordSearch(items, '과태료', 1).map((item) => item.id)).toEqual(['1']);
  });

  it.each(['', '   ', '\t\n'])('빈 질문에는 빈 배열을 반환한다: %j', (query) => {
    expect(keywordSearch(items, query)).toEqual([]);
  });

  it('기본 반환 개수는 최대 3개이다', () => {
    const many = Array.from({ length: 5 }, (_, index) => ({ ...items[0], id: String(index) }));
    expect(keywordSearch(many, '전입신고').map((item) => item.id)).toEqual(['0', '1', '2']);
  });

  it('동점이면 입력 순서를 유지한다', () => {
    expect(keywordSearch([items[2], items[0]], '과태료').map((item) => item.id)).toEqual(['3', '1']);
  });

  it('질문의 중복 키워드가 순위에 영향을 주지 않는다', () => {
    expect(keywordSearch(items, '보증금 과태료 과태료').map((item) => item.id)).toEqual(['1', '2', '3']);
  });

  it('같은 단어가 여러 필드에 있어도 한 번만 센다', () => {
    const repeated = [
      { id: 'a', title: '봉투', why: '봉투', howTo: '봉투' },
      { id: 'b', title: '봉투 쓰레기', why: '', howTo: '' },
    ];
    expect(keywordSearch(repeated, '봉투 쓰레기').map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('대소문자와 여러 공백, 탭, 줄바꿈을 처리한다', () => {
    const mixed = [{ title: 'Online 신청', why: '보증금 보호', howTo: '주민센터' }];
    expect(keywordSearch(mixed, '  ONLINE\t보증금\n주민센터  ')).toEqual(mixed);
  });

  it('빈 데이터에는 빈 배열을 반환한다', () => {
    expect(keywordSearch([], '전입신고')).toEqual([]);
  });

  it.each([0, -1, NaN, Infinity, -Infinity])('유효하지 않은 limit은 빈 배열이다: %s', (limit) => {
    expect(keywordSearch(items, '과태료', limit)).toEqual([]);
  });

  it('양의 소수 limit은 내림한다', () => {
    expect(keywordSearch(items, '과태료', 1.9)).toEqual([items[0]]);
    expect(keywordSearch(items, '과태료', 0.9)).toEqual([]);
  });

  it('입력 배열을 수정하지 않고 추가 필드와 원본 객체를 유지한다', () => {
    const source = items.map((item) => Object.freeze({ ...item, category: 'LIFE' }));
    const before = [...source];
    Object.freeze(source);

    const result = keywordSearch(source, '봉투 과태료');

    expect(source).toEqual(before);
    expect(result[0]).toBe(source[2]);
    expect(result[0].category).toBe('LIFE');
  });
});
