import { describe, it, expect } from 'vitest';
import { DUE_OFFSET_MAX, sortQueue, totalConfirmations, validatePromoteRequest } from '@/lib/promotion';
import type { PromotionQueueItem, QuestionItem, TaskDraft } from '@/lib/types';

const draft: TaskDraft = {
  title: '음식물쓰레기 버리는 방법 알아두기',
  why: '전용 용기에 버려야 수거됩니다.',
  howTo: '전용 수거용기에 담아 내 집 앞에 내놓습니다.',
  category: 'WASTE',
  dueOffsetDays: null,
  linkUrl: null,
  placeName: null,
  placeAddress: null,
  placePhone: null,
  housingTypes: ['ONE_ROOM', 'VILLA'],
  contractTypes: [],
  requiresCar: false,
  requiresPet: false,
  studentOnly: false,
};
const ok = { questionId: 'q1', task: draft, sourceNote: '주민 답변 + 운영자 확인 (2026-10-07)' };

describe('validatePromoteRequest', () => {
  it('정상 요청은 통과한다', () => {
    expect(validatePromoteRequest(ok)).toEqual({ ok: true, value: ok });
  });

  it('문자열 앞뒤 공백을 지운다', () => {
    const result = validatePromoteRequest({ ...ok, sourceNote: '  확인함  ', task: { ...draft, title: '  제목  ' } });
    expect(result.ok && result.value.sourceNote).toBe('확인함');
    expect(result.ok && result.value.task.title).toBe('제목');
  });

  // 모든 할 일은 출처가 있어야 한다. 승격된 할 일의 출처는 "누가 무엇을 근거로 확정했는가"다.
  it.each([undefined, '', '   '])('출처(sourceNote)가 없으면 거절한다: %j', (sourceNote) => {
    expect(validatePromoteRequest({ ...ok, sourceNote }).ok).toBe(false);
  });

  it.each(['title', 'why', 'howTo'] as const)('%s 가 비면 거절한다', (field) => {
    expect(validatePromoteRequest({ ...ok, task: { ...draft, [field]: '  ' } }).ok).toBe(false);
  });

  it('없는 카테고리는 거절한다', () => {
    expect(validatePromoteRequest({ ...ok, task: { ...draft, category: 'FOOD' } }).ok).toBe(false);
  });

  it('없는 주거형태 · 계약형태가 섞이면 거절한다', () => {
    expect(validatePromoteRequest({ ...ok, task: { ...draft, housingTypes: ['ONE_ROOM', 'CASTLE'] } }).ok).toBe(false);
    expect(validatePromoteRequest({ ...ok, task: { ...draft, contractTypes: ['RENT'] } }).ok).toBe(false);
  });

  // AI 초안이 틀리게 제안하기 쉬운 값이라 서버가 한 번 더 막는다. 이사일 기준이 아니면 null.
  it('기한은 0 이상 정수이거나 null 이다', () => {
    expect(validatePromoteRequest({ ...ok, task: { ...draft, dueOffsetDays: 14 } }).ok).toBe(true);
    expect(validatePromoteRequest({ ...ok, task: { ...draft, dueOffsetDays: 0 } }).ok).toBe(true);
    expect(validatePromoteRequest({ ...ok, task: { ...draft, dueOffsetDays: -1 } }).ok).toBe(false);
    expect(validatePromoteRequest({ ...ok, task: { ...draft, dueOffsetDays: 1.5 } }).ok).toBe(false);
    expect(validatePromoteRequest({ ...ok, task: { ...draft, dueOffsetDays: '7일' } }).ok).toBe(false);
    expect(validatePromoteRequest({ ...ok, task: { ...draft, dueOffsetDays: DUE_OFFSET_MAX + 1 } }).ok).toBe(false);
  });

  // 카드의 "신청 페이지 열기" 링크로 그대로 나간다. javascript: 같은 주소가 들어가면 안 된다.
  it('링크는 http · https 주소만 허용한다', () => {
    expect(validatePromoteRequest({ ...ok, task: { ...draft, linkUrl: 'https://www.gov.kr' } }).ok).toBe(true);
    expect(validatePromoteRequest({ ...ok, task: { ...draft, linkUrl: 'javascript:alert(1)' } }).ok).toBe(false);
    expect(validatePromoteRequest({ ...ok, task: { ...draft, linkUrl: 'gov.kr' } }).ok).toBe(false);
  });

  it('빈 문자열인 장소 · 연락처 · 링크는 null 로 바꾼다', () => {
    const result = validatePromoteRequest({ ...ok, task: { ...draft, placeName: ' ', placePhone: '', linkUrl: '' } });
    expect(result.ok && [result.value.task.placeName, result.value.task.placePhone, result.value.task.linkUrl])
      .toEqual([null, null, null]);
  });

  it('노출 조건 값은 참 · 거짓이어야 한다', () => {
    expect(validatePromoteRequest({ ...ok, task: { ...draft, requiresCar: 'yes' } }).ok).toBe(false);
  });

  // 서버가 정하는 값(source · verifiedAt)을 요청으로 덮어쓰지 못하게 결과에서 버린다.
  it('요청에 실린 source · verifiedAt 은 결과에 담기지 않는다', () => {
    const result = validatePromoteRequest({ ...ok, task: { ...draft, source: 'SEED', verifiedAt: '2020-01-01' } });
    expect(result.ok).toBe(true);
    expect(result.ok && Object.keys(result.value.task)).not.toContain('source');
    expect(result.ok && Object.keys(result.value.task)).not.toContain('verifiedAt');
  });

  it.each([null, 'text', [], { questionId: 'q1' }, { ...ok, questionId: '' }])('형식이 틀리면 거절한다: %j', (input) => {
    expect(validatePromoteRequest(input).ok).toBe(false);
  });

  it('거절할 때는 화면에 띄울 문장을 준다', () => {
    const result = validatePromoteRequest({ ...ok, sourceNote: '' });
    expect(!result.ok && result.error.length > 0).toBe(true);
  });
});

function question(id: string, createdAt: string): QuestionItem {
  return {
    id, text: id, askerNickname: null, ctxHousingType: null, ctxContractType: null,
    aiAnswer: null, confidence: 'UNKNOWN', status: 'ANSWERED', answers: [], createdAt,
  };
}

describe('totalConfirmations', () => {
  it('답변들의 확인 수를 더한다', () => {
    expect(totalConfirmations([{ confirmationCount: 2 }, { confirmationCount: 3 }])).toBe(5);
  });
  it('답변이 없으면 0 이다', () => {
    expect(totalConfirmations([])).toBe(0);
  });
});

describe('sortQueue', () => {
  // 테스트마다 새로 만든다. 한 테스트가 배열을 바꿔도 다른 테스트에 번지지 않게.
  const makeItems = (): PromotionQueueItem[] => [
    { question: question('a', '2026-10-05T00:00:00Z'), totalConfirmations: 1 },
    { question: question('b', '2026-10-03T00:00:00Z'), totalConfirmations: 4 },
    { question: question('c', '2026-10-01T00:00:00Z'), totalConfirmations: 1 },
  ];

  // 확인 수는 승격 조건이 아니라 정렬 기준이다 (승격시스템흐름 7절).
  it('확인 수가 많은 순, 같으면 먼저 물어본 순', () => {
    expect(sortQueue(makeItems()).map((i) => i.question.id)).toEqual(['b', 'c', 'a']);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const items = makeItems();
    sortQueue(items);
    expect(items.map((i) => i.question.id)).toEqual(['a', 'b', 'c']);
  });
});
