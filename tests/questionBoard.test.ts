import { describe, it, expect } from 'vitest';
import { answerSlot, askerContext, confirmSlot, parseTab, timeAgo, withAnswer, withConfirm } from '@/lib/questionBoard';
import type { AnswerItem, QuestionItem } from '@/lib/types';

function answer(id: string, over: Partial<AnswerItem> = {}): AnswerItem {
  return {
    id, questionId: 'q1', authorNickname: '주민', text: id,
    confirmationCount: 0, confirmedByMe: false, authoredByMe: false, createdAt: '2026-10-06T00:00:00Z', ...over,
  };
}

function question(id: string, over: Partial<QuestionItem> = {}): QuestionItem {
  return {
    id, text: id, askerNickname: null, ctxHousingType: null, ctxContractType: null,
    aiAnswer: null, confidence: 'UNKNOWN', status: 'OPEN', answers: [], createdAt: '2026-10-06T00:00:00Z', ...over,
  };
}

describe('parseTab', () => {
  it.each(['OPEN', 'ANSWERED', 'PROMOTED'] as const)('알려진 값은 그대로: %s', (s) => {
    expect(parseTab(s)).toBe(s);
  });

  it.each([undefined, '', 'open', 'DELETED', ['ANSWERED']])('모르는 값이면 답을 기다리는 질문: %j', (raw) => {
    expect(parseTab(raw)).toBe('OPEN');
  });
});

describe('withAnswer', () => {
  it('해당 질문에만 답변을 뒤에 붙인다', () => {
    const list = [question('q1', { answers: [answer('a1')] }), question('q2')];
    const next = withAnswer(list, 'q1', answer('a2'));
    expect(next[0].answers.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(next[1]).toBe(list[1]);
  });

  // 서버가 첫 답변에서 OPEN → ANSWERED 로 바꾼다. 화면이 따라가지 않으면 탭과 상태가 어긋난다.
  it('첫 답변이면 답변 대기 → 답변 있음', () => {
    expect(withAnswer([question('q1')], 'q1', answer('a1'))[0].status).toBe('ANSWERED');
  });

  it('이미 답변 있음이면 그대로 둔다', () => {
    expect(withAnswer([question('q1', { status: 'ANSWERED' })], 'q1', answer('a1'))[0].status).toBe('ANSWERED');
  });

  // 응답이 늦게 와서 같은 답변이 두 번 반영돼도 한 줄만 남는다.
  it('같은 답변을 두 번 붙이지 않는다', () => {
    const once = withAnswer([question('q1')], 'q1', answer('a1'));
    expect(withAnswer(once, 'q1', answer('a1'))[0].answers).toHaveLength(1);
  });

  it('원본 목록을 바꾸지 않는다', () => {
    const list = [question('q1')];
    withAnswer(list, 'q1', answer('a1'));
    expect(list[0].answers).toHaveLength(0);
    expect(list[0].status).toBe('OPEN');
  });
});

describe('withConfirm', () => {
  const list = [
    question('q1', { answers: [answer('a1', { confirmationCount: 2 }), answer('a2', { confirmationCount: 5 })] }),
    question('q2', { answers: [answer('b1')] }),
  ];

  // 다른 사람이 동시에 눌렀을 수 있다. 내가 +1 하지 않고 서버가 다시 센 값을 쓴다.
  it('개수는 서버 값으로 바꾸고 눌렀음을 표시한다', () => {
    const next = withConfirm(list, 'a1', { confirmationCount: 7, confirmedByMe: true });
    expect(next[0].answers[0]).toMatchObject({ confirmationCount: 7, confirmedByMe: true });
  });

  it('다른 답변 · 다른 질문은 건드리지 않는다', () => {
    const next = withConfirm(list, 'a1', { confirmationCount: 7, confirmedByMe: true });
    expect(next[0].answers[1]).toBe(list[0].answers[1]);
    expect(next[1]).toBe(list[1]);
  });

  it('원본 목록을 바꾸지 않는다', () => {
    withConfirm(list, 'a1', { confirmationCount: 7, confirmedByMe: true });
    expect(list[0].answers[0].confirmationCount).toBe(2);
  });
});

describe('askerContext', () => {
  it('주거 · 계약 형태를 글자로', () => {
    expect(askerContext({ ctxHousingType: 'ONE_ROOM', ctxContractType: 'MONTHLY' })).toBe('원룸 · 월세 사는 분의 질문');
  });

  it('하나만 있으면 그것만', () => {
    expect(askerContext({ ctxHousingType: 'DORM', ctxContractType: null })).toBe('기숙사 사는 분의 질문');
  });

  it('둘 다 없으면 null', () => {
    expect(askerContext({ ctxHousingType: null, ctxContractType: null })).toBeNull();
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-10-06T12:00:00Z');
  it.each([
    ['2026-10-06T11:59:30Z', '방금'],
    ['2026-10-06T11:59:00Z', '1분 전'],
    ['2026-10-06T11:01:00Z', '59분 전'],
    ['2026-10-06T11:00:00Z', '1시간 전'],
    ['2026-10-05T12:00:01Z', '23시간 전'],
    ['2026-10-05T12:00:00Z', '1일 전'],
    ['2026-09-29T12:00:01Z', '6일 전'],
  ])('%s → %s', (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });

  // 9/28 16:00 UTC 는 한국 시간으로 9/29 새벽 1시다. 서버 시간대를 따르면 하루 어긋난다.
  it('일주일이 넘으면 한국 시간 기준 날짜', () => {
    expect(timeAgo('2026-09-28T16:00:00Z', now)).toBe('9월 29일');
    expect(timeAgo('2026-09-28T14:59:00Z', now)).toBe('9월 28일');
  });

  it('미래 시각(기기 시계가 느릴 때)은 방금', () => {
    expect(timeAgo('2026-10-06T12:05:00Z', now)).toBe('방금');
  });
});

describe('answerSlot', () => {
  it('할 일이 된 질문에는 더 답할 수 없다 (로그인 여부와 무관)', () => {
    expect(answerSlot('PROMOTED', { loaded: true, loggedIn: true })).toBe('closed');
    expect(answerSlot('PROMOTED', { loaded: false, loggedIn: false })).toBe('closed');
  });

  // 로그인 확인 전에 "로그인하세요"를 띄우면 로그인한 사람에게도 한 번 깜빡인다.
  it('로그인 여부를 아직 모르면 아무것도 띄우지 않는다', () => {
    expect(answerSlot('OPEN', { loaded: false, loggedIn: false })).toBe('pending');
  });

  it.each(['OPEN', 'ANSWERED'] as const)('%s: 로그인했으면 답변 양식, 아니면 로그인 안내', (status) => {
    expect(answerSlot(status, { loaded: true, loggedIn: true })).toBe('form');
    expect(answerSlot(status, { loaded: true, loggedIn: false })).toBe('login');
  });
});

describe('confirmSlot', () => {
  const mine = { authoredByMe: true };
  const others = { authoredByMe: false };

  it.each(['OPEN', 'ANSWERED'] as const)('%s: 로그인했고 남의 답변이면 버튼', (status) => {
    expect(confirmSlot(others, { loggedIn: true, status })).toBe('button');
  });

  // 내 답변에 버튼을 두면 누를 때마다 403 이다. 처음부터 개수만 보여준다.
  it('내가 쓴 답변은 개수만', () => {
    expect(confirmSlot(mine, { loggedIn: true, status: 'ANSWERED' })).toBe('count');
  });

  it('로그인 안 했으면 개수만', () => {
    expect(confirmSlot(others, { loggedIn: false, status: 'ANSWERED' })).toBe('count');
  });

  it('할 일로 정리된 질문은 개수만', () => {
    expect(confirmSlot(others, { loggedIn: true, status: 'PROMOTED' })).toBe('count');
  });
});
