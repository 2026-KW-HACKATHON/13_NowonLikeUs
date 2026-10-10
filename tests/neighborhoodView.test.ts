import { describe, it, expect } from 'vitest';
import { geoErrorOutcome, neighborhoodMessage, withMyNeighborhood, type NeighborhoodOutcome } from '@/lib/neighborhoodView';
import type { AnswerItem, QuestionItem } from '@/lib/types';

function answer(id: string, over: Partial<AnswerItem> = {}): AnswerItem {
  return {
    id, questionId: 'q1', authorNickname: '주민', text: id,
    confirmationCount: 0, confirmedByMe: false, authoredByMe: false, authorNeighborhoodVerified: false,
    createdAt: '2026-10-06T00:00:00Z', ...over,
  };
}

function question(id: string, answers: AnswerItem[]): QuestionItem {
  return {
    id, text: id, askerNickname: null, ctxHousingType: null, ctxContractType: null,
    aiAnswer: null, confidence: 'UNKNOWN', status: 'ANSWERED', answers, createdAt: '2026-10-06T00:00:00Z',
  };
}

describe('geoErrorOutcome', () => {
  it('권한 거부 · 시간 초과는 따로', () => {
    expect(geoErrorOutcome(1)).toBe('denied');
    expect(geoErrorOutcome(3)).toBe('timeout');
  });

  it.each([2, 0, 99])('그 밖은 위치를 못 찾은 것으로: %i', (code) => {
    expect(geoErrorOutcome(code)).toBe('unavailable');
  });
});

describe('neighborhoodMessage', () => {
  const all: NeighborhoodOutcome[] = ['inside', 'outside', 'inaccurate', 'denied', 'timeout', 'unavailable', 'failed'];

  it('성공은 inside 하나뿐', () => {
    expect(all.filter((o) => neighborhoodMessage(o).ok)).toEqual(['inside']);
  });

  it('결과마다 문구가 다르다', () => {
    expect(new Set(all.map((o) => neighborhoodMessage(o).text)).size).toBe(all.length);
  });

  it('성공 문구에 배지 이름과 유효 기간', () => {
    const { text } = neighborhoodMessage('inside');
    expect(text).toContain('노원 인증');
    expect(text).toContain('180일');
  });
});

describe('withMyNeighborhood', () => {
  it('내 답변의 배지만 바꾼다', () => {
    const list = [question('q1', [answer('mine', { authoredByMe: true }), answer('other')])];
    const [q] = withMyNeighborhood(list, true);
    expect(q.answers.map((a) => [a.id, a.authorNeighborhoodVerified])).toEqual([
      ['mine', true],
      ['other', false],
    ]);
  });

  it('지우면 내 배지만 내리고 다른 사람 배지는 그대로', () => {
    const list = [
      question('q1', [
        answer('mine', { authoredByMe: true, authorNeighborhoodVerified: true }),
        answer('other', { authorNeighborhoodVerified: true }),
      ]),
    ];
    const [q] = withMyNeighborhood(list, false);
    expect(q.answers.map((a) => a.authorNeighborhoodVerified)).toEqual([false, true]);
  });

  it('여러 질문에 걸친 내 답변을 모두 맞춘다', () => {
    const list = [question('q1', [answer('a', { authoredByMe: true })]), question('q2', [answer('b', { authoredByMe: true })])];
    expect(withMyNeighborhood(list, true).flatMap((q) => q.answers.map((a) => a.authorNeighborhoodVerified))).toEqual([true, true]);
  });

  it('바뀔 게 없는 질문은 같은 객체를 그대로', () => {
    const untouched = question('q2', [answer('other')]);
    const list = [question('q1', [answer('mine', { authoredByMe: true })]), untouched];
    expect(withMyNeighborhood(list, true)[1]).toBe(untouched);
  });

  it('아무것도 안 바뀌면 같은 배열', () => {
    const list = [question('q1', [answer('mine', { authoredByMe: true, authorNeighborhoodVerified: true })])];
    expect(withMyNeighborhood(list, true)).toBe(list);
  });
});
