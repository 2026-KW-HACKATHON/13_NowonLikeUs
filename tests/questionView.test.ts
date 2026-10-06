import { describe, it, expect } from 'vitest';
import {
  ANSWER_MAX,
  byConfirmations,
  parseStatusFilter,
  toAnswerItem,
  toQuestionItem,
  validateAnswerText,
  type AnswerRow,
  type QuestionRow,
} from '@/lib/questionView';

const answer = (over: Partial<AnswerRow> = {}): AnswerRow => ({
  id: 'a1',
  questionId: 'q1',
  text: '목요일에 내놓으면 돼요',
  isHidden: false,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  author: { nickname: '월계주민' },
  confirmations: [],
  ...over,
});

const question = (over: Partial<QuestionRow> = {}): QuestionRow => ({
  id: 'q1',
  text: '페트병은 언제 버려요?',
  ctxHousingType: 'ONE_ROOM',
  ctxContractType: 'MONTHLY',
  aiAnswer: '재활용 카드를 확인하세요.',
  confidence: 'GROUNDED',
  status: 'ANSWERED',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  asker: { nickname: '새내기' },
  answers: [],
  ...over,
});

describe('toAnswerItem', () => {
  it('확인 수를 세고 작성자는 닉네임만 담는다', () => {
    const item = toAnswerItem(answer({ confirmations: [{ userId: 'u1' }, { userId: 'u2' }] }), null);
    expect(item.confirmationCount).toBe(2);
    expect(item.authorNickname).toBe('월계주민');
    expect(item.createdAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('내가 눌렀으면 confirmedByMe 가 true 다', () => {
    const row = answer({ confirmations: [{ userId: 'u1' }] });
    expect(toAnswerItem(row, 'u1').confirmedByMe).toBe(true);
    expect(toAnswerItem(row, 'u2').confirmedByMe).toBe(false);
  });

  it('로그인하지 않았으면 confirmedByMe 는 항상 false 다', () => {
    expect(toAnswerItem(answer({ confirmations: [{ userId: 'u1' }] }), null).confirmedByMe).toBe(false);
  });
});

describe('toQuestionItem', () => {
  it('숨김 답변은 빼고 내려준다', () => {
    const item = toQuestionItem(
      question({ answers: [answer({ id: 'a1' }), answer({ id: 'a2', isHidden: true })] }),
      null,
    );
    expect(item.answers.map((a) => a.id)).toEqual(['a1']);
  });

  it('맞아요가 많은 답변이 위로 온다, 같으면 먼저 달린 순', () => {
    const item = toQuestionItem(
      question({
        answers: [
          answer({ id: 'old0', createdAt: new Date('2026-10-01T00:00:00Z') }),
          answer({ id: 'new0', createdAt: new Date('2026-10-02T00:00:00Z') }),
          answer({ id: 'many', confirmations: [{ userId: 'u1' }, { userId: 'u2' }] }),
        ],
      }),
      null,
    );
    expect(item.answers.map((a) => a.id)).toEqual(['many', 'old0', 'new0']);
  });

  it('비로그인 질문은 askerNickname 이 null 이다', () => {
    expect(toQuestionItem(question({ asker: null }), null).askerNickname).toBeNull();
  });

  it('AI 가 모른다고 한 질문(UNKNOWN)은 aiAnswer 를 null 로 내린다', () => {
    const item = toQuestionItem(question({ confidence: 'UNKNOWN', aiAnswer: '확인되지 않은 내용입니다' }), null);
    expect(item.aiAnswer).toBeNull();
  });
});

describe('byConfirmations', () => {
  it('확인 수 내림차순', () => {
    const a = toAnswerItem(answer({ confirmations: [] }), null);
    const b = toAnswerItem(answer({ confirmations: [{ userId: 'x' }] }), null);
    expect([a, b].sort(byConfirmations)[0]).toBe(b);
  });
});

describe('parseStatusFilter', () => {
  it('없으면 null(전부)', () => {
    expect(parseStatusFilter(null)).toBeNull();
    expect(parseStatusFilter('')).toBeNull();
  });

  it('알려진 상태는 그대로', () => {
    expect(parseStatusFilter('ANSWERED')).toBe('ANSWERED');
  });

  it('모르는 값은 undefined(400 대상)', () => {
    expect(parseStatusFilter('answered')).toBeUndefined();
    expect(parseStatusFilter('DELETED')).toBeUndefined();
  });
});

describe('validateAnswerText', () => {
  it('앞뒤 공백을 지운다', () => {
    expect(validateAnswerText({ text: '  목요일이요  ' })).toEqual({ ok: true, text: '목요일이요' });
  });

  it('비었거나 공백뿐이면 거절한다', () => {
    expect(validateAnswerText({ text: '' }).ok).toBe(false);
    expect(validateAnswerText({ text: '   ' }).ok).toBe(false);
  });

  it(`${ANSWER_MAX}자까지 허용하고 넘으면 거절한다 (한글도 한 글자로 센다)`, () => {
    expect(validateAnswerText({ text: '가'.repeat(ANSWER_MAX) }).ok).toBe(true);
    expect(validateAnswerText({ text: '가'.repeat(ANSWER_MAX + 1) }).ok).toBe(false);
  });

  it.each([null, 'text', [], { text: 42 }])('형식이 아니면 거절한다: %j', (input) => {
    expect(validateAnswerText(input).ok).toBe(false);
  });
});
