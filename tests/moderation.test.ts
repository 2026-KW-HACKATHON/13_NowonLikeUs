import { describe, it, expect } from 'vitest';
import { canDeleteQuestion, validateHideAnswer } from '@/lib/moderation';

describe('validateHideAnswer', () => {
  it('숨기기 요청을 받는다', () => {
    expect(validateHideAnswer({ isHidden: true })).toEqual({ ok: true, value: { isHidden: true } });
  });

  it('되돌리기 요청을 받는다', () => {
    expect(validateHideAnswer({ isHidden: false })).toEqual({ ok: true, value: { isHidden: false } });
  });

  it('다른 필드는 무시하고 isHidden 만 꺼낸다', () => {
    expect(validateHideAnswer({ isHidden: true, text: '바꿔치기' })).toEqual({ ok: true, value: { isHidden: true } });
  });

  it.each([
    ['문자열 "true"', { isHidden: 'true' }],
    ['숫자 1', { isHidden: 1 }],
    ['null', { isHidden: null }],
    ['필드 없음', {}],
  ])('isHidden 이 불리언이 아니면 거절한다 — %s', (_label, input) => {
    expect(validateHideAnswer(input)).toEqual({ ok: false, error: '요청 형식이 올바르지 않습니다.' });
  });

  it.each([
    ['null', null],
    ['배열', [true]],
    ['문자열', 'hide'],
    ['undefined', undefined],
  ])('본문이 객체가 아니면 거절한다 — %s', (_label, input) => {
    expect(validateHideAnswer(input)).toEqual({ ok: false, error: '요청 형식이 올바르지 않습니다.' });
  });
});

describe('canDeleteQuestion', () => {
  it('답을 기다리는 질문과 답이 달린 질문은 지울 수 있다', () => {
    expect(canDeleteQuestion('OPEN')).toBe(true);
    expect(canDeleteQuestion('ANSWERED')).toBe(true);
  });

  it('할 일로 정리된 질문은 지울 수 없다 — 발행된 할 일의 출처다', () => {
    expect(canDeleteQuestion('PROMOTED')).toBe(false);
  });
});
