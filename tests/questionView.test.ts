import { describe, it, expect } from 'vitest';
import { parseStatusFilter, toAnswerItem, toQuestionItem, type AnswerRow, type QuestionRow } from '@/lib/questionView';

const answer = (over: Partial<AnswerRow> = {}): AnswerRow => ({
  id: 'a1',
  questionId: 'q1',
  text: '목요일에 내놓으면 돼요',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  authorId: 'author-1',
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
    const item = toAnswerItem(answer({ _count: { confirmations: 2 } }), null);
    expect(item.confirmationCount).toBe(2);
    expect(item.authorNickname).toBe('월계주민');
    expect(item.createdAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('내 확인 행이 있으면 confirmedByMe 가 true, 없으면 false', () => {
    expect(toAnswerItem(answer({ confirmations: [{ id: 'c1' }] }), 'viewer').confirmedByMe).toBe(true);
    expect(toAnswerItem(answer({ confirmations: [] }), 'viewer').confirmedByMe).toBe(false);
  });

  // 닉네임은 겹칠 수 있어 화면에서 비교할 수 없다. 서버가 작성자 id 로 비교해 내려준다.
  it('내가 쓴 답변이면 authoredByMe 가 true', () => {
    expect(toAnswerItem(answer({ authorId: 'author-1' }), 'author-1').authoredByMe).toBe(true);
  });

  it('남이 쓴 답변이면 authoredByMe 가 false (닉네임이 같아도)', () => {
    expect(toAnswerItem(answer({ authorId: 'author-1' }), 'someone-else').authoredByMe).toBe(false);
  });

  it('로그인하지 않았으면 authoredByMe 는 false', () => {
    expect(toAnswerItem(answer({ authorId: 'author-1' }), null).authoredByMe).toBe(false);
  });

  // 작성자 id 는 비교에만 쓴다. 응답에 실리면 다른 사람의 id 가 노출된다.
  it('결과에 이메일 · 작성자 id 가 없다', () => {
    const item = toAnswerItem(answer(), 'author-1');
    expect(Object.keys(item).sort()).toEqual(
      ['authorNickname', 'authoredByMe', 'confirmationCount', 'confirmedByMe', 'createdAt', 'id', 'questionId', 'text'],
    );
    expect(JSON.stringify(item)).not.toContain('author-1');
  });
});

describe('toQuestionItem', () => {
  it('보는 사람(viewerId)을 답변까지 넘긴다, 없으면 비로그인으로 본다', () => {
    const row = question({ answers: [answer({ id: 'mine', authorId: 'me' }), answer({ id: 'theirs', authorId: 'other' })] });
    expect(toQuestionItem(row, { viewerId: 'me' }).answers.map((a) => a.authoredByMe)).toEqual([true, false]);
    expect(toQuestionItem(row).answers.map((a) => a.authoredByMe)).toEqual([false, false]);
  });

  it('답변 순서는 받은 순서(오래된 순) 그대로 둔다', () => {
    const item = toQuestionItem(question({ answers: [answer({ id: 'first' }), answer({ id: 'second', _count: { confirmations: 9 } })] }));
    expect(item.answers.map((a) => a.id)).toEqual(['first', 'second']);
  });

  // 질문은 익명이다. 공개 목록에는 질문자 닉네임을 내리지 않고, 운영자 승격 큐에서만 보여준다.
  it('기본(공개 목록)은 질문자가 있어도 askerNickname 이 null 이다', () => {
    expect(toQuestionItem(question({ asker: { nickname: '새내기' } })).askerNickname).toBeNull();
  });

  it('운영자 큐(showAsker)에서는 질문자 닉네임을 보여준다, 비로그인 질문은 null', () => {
    expect(toQuestionItem(question({ asker: { nickname: '새내기' } }), { showAsker: true }).askerNickname).toBe('새내기');
    expect(toQuestionItem(question({ asker: null }), { showAsker: true }).askerNickname).toBeNull();
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
