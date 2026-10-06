import { describe, it, expect } from 'vitest';
import {
  DUE_OFFSET_MAX,
  SOURCE_NOTE_MAX,
  TITLE_MAX,
  buildPromotionQueue,
  totalConfirmations,
  validatePromoteRequest,
} from '@/lib/promotion';
import type { AnswerItem, QuestionItem, TaskDraft } from '@/lib/types';

const answer = (count: number, id = 'a'): AnswerItem => ({
  id,
  questionId: 'q',
  authorNickname: '주민',
  text: '답변',
  confirmationCount: count,
  confirmedByMe: false,
  createdAt: '2026-10-01T00:00:00.000Z',
});

const question = (over: Partial<QuestionItem> = {}): QuestionItem => ({
  id: 'q1',
  text: '질문',
  askerNickname: null,
  ctxHousingType: null,
  ctxContractType: null,
  aiAnswer: null,
  confidence: 'UNKNOWN',
  status: 'ANSWERED',
  answers: [answer(0)],
  createdAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

const draft: TaskDraft = {
  title: '페트병은 목요일에',
  why: '다른 날 내놓으면 수거되지 않습니다.',
  howTo: '투명 페트병은 목요일에만 내 집 앞에 내놓습니다.',
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

const request = (over: Record<string, unknown> = {}, taskOver: Record<string, unknown> = {}) => ({
  questionId: 'q1',
  sourceNote: '주민 답변(확인 3) + 노원구청 재활용 배출안내로 운영자 확인',
  task: { ...draft, ...taskOver },
  ...over,
});

describe('totalConfirmations', () => {
  it('모든 답변의 맞아요를 더한다', () => {
    expect(totalConfirmations(question({ answers: [answer(2, 'a'), answer(3, 'b')] }))).toBe(5);
  });
});

describe('buildPromotionQueue', () => {
  it('ANSWERED 질문만 넣는다', () => {
    const queue = buildPromotionQueue([
      question({ id: 'open', status: 'OPEN', answers: [] }),
      question({ id: 'answered' }),
      question({ id: 'promoted', status: 'PROMOTED' }),
    ]);
    expect(queue.map((i) => i.question.id)).toEqual(['answered']);
  });

  it('보이는 답변이 없으면 넣지 않는다 (답변이 전부 숨김 처리된 경우)', () => {
    expect(buildPromotionQueue([question({ answers: [] })])).toEqual([]);
  });

  it('맞아요 합계가 많은 순, 같으면 오래 기다린 질문이 먼저', () => {
    const queue = buildPromotionQueue([
      question({ id: 'new1', createdAt: '2026-10-03T00:00:00.000Z', answers: [answer(1)] }),
      question({ id: 'many', createdAt: '2026-10-02T00:00:00.000Z', answers: [answer(2, 'a'), answer(2, 'b')] }),
      question({ id: 'old1', createdAt: '2026-10-01T00:00:00.000Z', answers: [answer(1)] }),
    ]);
    expect(queue.map((i) => i.question.id)).toEqual(['many', 'old1', 'new1']);
    expect(queue[0].totalConfirmations).toBe(4);
  });
});

describe('validatePromoteRequest', () => {
  it('정상 요청은 통과하고 문자열 앞뒤 공백을 지운다', () => {
    const result = validatePromoteRequest(request({ sourceNote: '  운영자 확인  ' }, { title: '  페트병  ' }));
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.task.title).toBe('페트병');
    expect(result.ok && result.value.sourceNote).toBe('운영자 확인');
  });

  // 모든 할 일은 출처가 있어야 한다. 승격된 할 일도 예외가 아니다.
  it('출처가 비면 거절한다', () => {
    expect(validatePromoteRequest(request({ sourceNote: '' })).ok).toBe(false);
    expect(validatePromoteRequest(request({ sourceNote: '   ' })).ok).toBe(false);
    expect(validatePromoteRequest(request({ sourceNote: undefined })).ok).toBe(false);
  });

  it(`출처가 ${SOURCE_NOTE_MAX}자를 넘으면 거절한다`, () => {
    expect(validatePromoteRequest(request({ sourceNote: '가'.repeat(SOURCE_NOTE_MAX + 1) })).ok).toBe(false);
  });

  it('제목 · 이유 · 방법이 비면 거절한다', () => {
    expect(validatePromoteRequest(request({}, { title: ' ' })).ok).toBe(false);
    expect(validatePromoteRequest(request({}, { why: '' })).ok).toBe(false);
    expect(validatePromoteRequest(request({}, { howTo: '' })).ok).toBe(false);
  });

  it(`제목이 ${TITLE_MAX}자를 넘으면 거절한다`, () => {
    expect(validatePromoteRequest(request({}, { title: '가'.repeat(TITLE_MAX) })).ok).toBe(true);
    expect(validatePromoteRequest(request({}, { title: '가'.repeat(TITLE_MAX + 1) })).ok).toBe(false);
  });

  it('모르는 분류는 거절한다', () => {
    expect(validatePromoteRequest(request({}, { category: 'FOOD' })).ok).toBe(false);
  });

  // 이사일 기준 기한이 아니면 null 이다. AI 가 틀리게 제안하기 쉬운 자리라 범위를 좁힌다.
  it(`기한은 null 이거나 0~${DUE_OFFSET_MAX} 정수만 받는다`, () => {
    expect(validatePromoteRequest(request({}, { dueOffsetDays: 14 })).ok).toBe(true);
    expect(validatePromoteRequest(request({}, { dueOffsetDays: null })).ok).toBe(true);
    expect(validatePromoteRequest(request({}, { dueOffsetDays: -1 })).ok).toBe(false);
    expect(validatePromoteRequest(request({}, { dueOffsetDays: 1.5 })).ok).toBe(false);
    expect(validatePromoteRequest(request({}, { dueOffsetDays: DUE_OFFSET_MAX + 1 })).ok).toBe(false);
    expect(validatePromoteRequest(request({}, { dueOffsetDays: '14' })).ok).toBe(false);
  });

  it('링크는 http(s) 만 받고, 빈 문자열은 null 로 바꾼다', () => {
    expect(validatePromoteRequest(request({}, { linkUrl: 'javascript:alert(1)' })).ok).toBe(false);
    const ok = validatePromoteRequest(request({}, { linkUrl: 'https://smartclean.nowon.kr', placePhone: '' }));
    expect(ok.ok && ok.value.task.linkUrl).toBe('https://smartclean.nowon.kr');
    expect(ok.ok && ok.value.task.placePhone).toBeNull();
  });

  it('노출 조건은 정해진 값만 받고 중복을 지운다', () => {
    const ok = validatePromoteRequest(request({}, { housingTypes: ['ONE_ROOM', 'ONE_ROOM'] }));
    expect(ok.ok && ok.value.task.housingTypes).toEqual(['ONE_ROOM']);
    expect(validatePromoteRequest(request({}, { housingTypes: ['CASTLE'] })).ok).toBe(false);
    expect(validatePromoteRequest(request({}, { contractTypes: 'MONTHLY' })).ok).toBe(false);
    expect(validatePromoteRequest(request({}, { requiresCar: 'yes' })).ok).toBe(false);
  });

  it('빈 노출 조건은 "전원 해당"으로 그대로 통과한다', () => {
    const ok = validatePromoteRequest(request({}, { housingTypes: [], contractTypes: [] }));
    expect(ok.ok && ok.value.task.housingTypes).toEqual([]);
  });

  it.each([null, 'text', [], { questionId: 'q1' }, { questionId: '', task: draft, sourceNote: 'x' }])(
    '형식이 아니면 거절한다: %j',
    (input) => {
      expect(validatePromoteRequest(input).ok).toBe(false);
    },
  );

  it('결과에는 정해진 필드만 담긴다 (요청에 끼워 넣은 source · isPublished 는 버린다)', () => {
    const ok = validatePromoteRequest(request({}, { source: 'SEED', isPublished: false, verifiedAt: '2020-01-01' }));
    expect(ok.ok && Object.keys(ok.value.task).sort()).toEqual(Object.keys(draft).sort());
  });
});
