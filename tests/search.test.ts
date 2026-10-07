import { describe, expect, it } from 'vitest';

import { keywordSearch } from '@/lib/search';

const items = [
  { id: '1', title: '전입신고 하기', why: '과태료가 부과됩니다', howTo: '주민센터 방문' },
  { id: '2', title: '확정일자 받기', why: '보증금 보호', howTo: '임대차계약서 지참' },
  { id: '3', title: '음식물 쓰레기 버리기', why: '과태료', howTo: '전용 봉투 사용' },
];

describe('keywordSearch', () => {
  it.each(['전입신고는 언제 하나요', '전입신고를 어떻게 하나요?', '전입신고는?', '"전입신고"', '전입신고에서', '전입신고까지'])('조사와 문장부호가 붙어도 검색한다: %s', (query) => {
    expect(keywordSearch(items, query).map((item) => item.id)).toEqual(['1']);
  });

  it('긴 조사를 먼저 처리한다', () => {
    expect(keywordSearch(items, '보증금으로').map((item) => item.id)).toEqual(['2']);
  });

  it('조사 변형을 반복해도 같은 키워드의 점수를 중복 계산하지 않는다', () => {
    expect(keywordSearch(items, '보증금 보증금을 보증금은 임대차계약서').map((item) => item.id)).toEqual(['2']);
    expect(keywordSearch(items, '확정일자 확정일자를 확정일자는 과태료').map((item) => item.id)).toEqual(['2']);
  });

  it('조사처럼 끝나는 원래 단어의 일치는 유지한다', () => {
    const data = [{ title: '어린이', why: '', howTo: '' }];
    expect(keywordSearch(data, '어린이')).toEqual(data);
  });

  it('조사를 제거해 한 글자 검색으로 확대하지 않는다', () => {
    expect(keywordSearch([{ title: '지하철', why: '', howTo: '' }], '지도')).toEqual([]);
  });

  it('문장부호만 있으면 빈 배열이다', () => {
    expect(keywordSearch(items, '?! ...')).toEqual([]);
  });

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
    expect(keywordSearch(items, '쓰레기 봉투 과태료 전입신고').map((item) => item.id)).toEqual(['3', '1']);
  });

  it('흔한 질문 표현은 키워드로 쓰지 않는다', () => {
    const data = [{ id: 'x', title: '전월세 신고하기', why: '30일 안에 신고해야 합니다', howTo: '' }];
    expect(keywordSearch(data, '인터넷 설치 하려면 어떻게 해야 하나요')).toEqual([]);
    expect(keywordSearch(data, '어떻게 해야 하나요')).toEqual([]);
  });

  it('키워드가 여럿인 질문에서 하나만 걸렸으면 제목에 걸린 항목만 인정한다', () => {
    const data = [
      { id: 'tax', title: '월세 세액공제 챙기기', why: '', howTo: '임대차계약서와 전입신고 등록 확인' },
      { id: 'pet', title: '반려견 동물등록하기', why: '', howTo: '' },
    ];
    expect(keywordSearch(data, '고양이 등록 어디서 하나요').map((item) => item.id)).toEqual(['pet']);
    expect(keywordSearch(items, '확정일자 받는 곳').map((item) => item.id)).toEqual(['2']);
  });

  it('서술부는 의미 있는 키워드 수에 넣지 않아 본문 일치도 인정한다', () => {
    expect(keywordSearch(items, '보증금 지키려면 뭐 해야 해요').map((item) => item.id)).toEqual(['2']);
  });

  it('조사가 붙은 한 글자 질문 표현도 키워드로 쓰지 않는다', () => {
    const data = [{ id: 'move', title: '전입신고 하기', why: '이사 후 14일 안에', howTo: '' }];
    expect(keywordSearch(data, '이사 하면 뭐부터').map((item) => item.id)).toEqual(['move']);
    expect(keywordSearch(data, '뭐가 좋은 곳은')).toEqual([]);
  });

  it('한 글자 키워드는 우연히 겹친 제목으로 순위를 올리거나 혼자 걸린 항목을 인정하지 않는다', () => {
    const data = [
      { id: 'date', title: '확정일자 받기', why: '', howTo: '주민센터' },
      { id: 'move', title: '전입신고 하기', why: '', howTo: '주민센터 신청' },
    ];
    expect(keywordSearch(data, '주민센터 신청 자').map((item) => item.id)).toEqual(['move', 'date']);
    expect(keywordSearch([{ id: 'park', title: '주차 등록', why: '', howTo: '' }], '차 보험').map((item) => item.id)).toEqual([]);
  });

  it('점수가 같으면 제목에 걸린 키워드가 많은 항목이 먼저 온다', () => {
    const data = [
      { id: 'move', title: '전입신고 하기', why: '확정일자와 함께 해두세요', howTo: '' },
      { id: 'date', title: '확정일자 받기', why: '', howTo: '' },
    ];
    expect(keywordSearch(data, '확정일자는 왜 받아야 돼요').map((item) => item.id)).toEqual(['date', 'move']);
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
    expect(keywordSearch(items, '전입신고 과태료 과태료 쓰레기').map((item) => item.id)).toEqual(['1', '3']);
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
