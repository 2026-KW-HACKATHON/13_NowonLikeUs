import { describe, it, expect } from 'vitest';
import { parseStatusFilter, toAnswerItem, toQuestionItem, type AnswerRow, type QuestionRow } from '@/lib/questionView';

const answer = (over: Partial<AnswerRow> = {}): AnswerRow => ({
  id: 'a1',
  questionId: 'q1',
  text: '목요일에 내놓으면 돼요',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  author: { nickname: '월계주민' },
  _count: { confirmations: 0 },
  confirmations: [],
  ...over,
});

const question = (over: Partial<QuestionRow> = {}): QuestionRow => ({
  id: 'q1',
  text: '페트병은 언제 버려요?',
  ctxHousingType: 'ONE_ROOM',
  ctxContractType: 'MONTHLY',
  aiAnswer: '재활용 카드를 확인하세요.',
  confidence: 'PARTIAL',
  status: 'ANSWERED',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  asker: { nickname: '새내기' },
  answers: [],
  ...over,
});

describe('toAnswerItem', () => {
  it('확인 수는 _count 로, 작성자는 닉네임만 담는다', () => {
    const item = toAnswerItem(answer({ _count: { confirmations: 2 } }));
    expect(item.confirmationCount).toBe(2);
    expect(item.authorNickname).toBe('월계주민');
    expect(item.createdAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('내 확인 행이 있으면 confirmedByMe 가 true, 없으면 false', () => {
    expect(toAnswerItem(answer({ confirmations: [{ id: 'c1' }] })).confirmedByMe).toBe(true);
    expect(toAnswerItem(answer({ confirmations: [] })).confirmedByMe).toBe(false);
  });

  it('이메일 같은 필드가 결과에 없다', () => {
    expect(Object.keys(toAnswerItem(answer())).sort()).toEqual(
      ['authorNickname', 'confirmationCount', 'confirmedByMe', 'createdAt', 'id', 'questionId', 'text'],
    );
  });
});

describe('toQuestionItem', () => {
  it('답변 순서는 받은 순서(오래된 순) 그대로 둔다', () => {
    const item = toQuestionItem(question({ answers: [answer({ id: 'first' }), answer({ id: 'second', _count: { confirmations: 9 } })] }));
    expect(item.answers.map((a) => a.id)).toEqual(['first', 'second']);
  });

  it('비로그인으로 물은 질문은 askerNickname 이 null 이다', () => {
    expect(toQuestionItem(question({ asker: null })).askerNickname).toBeNull();
  });

  it('UNKNOWN 질문은 aiAnswer 를 null 로 내린다', () => {
    expect(toQuestionItem(question({ confidence: 'UNKNOWN', aiAnswer: '확인되지 않은 내용입니다' })).aiAnswer).toBeNull();
    expect(toQuestionItem(question({ confidence: 'PARTIAL' })).aiAnswer).toBe('재활용 카드를 확인하세요.');
  });
});

describe('parseStatusFilter', () => {
  it('없으면 null(전부), 아는 값은 그대로, 모르는 값은 undefined(400)', () => {
    expect(parseStatusFilter(null)).toBeNull();
    expect(parseStatusFilter('')).toBeNull();
    expect(parseStatusFilter('ANSWERED')).toBe('ANSWERED');
    expect(parseStatusFilter('answered')).toBeUndefined();
  });
});
