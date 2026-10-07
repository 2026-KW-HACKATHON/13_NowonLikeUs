import { describe, it, expect } from 'vitest';
import { ANSWER_MAX, validateAnswer } from '@/lib/answerValidation';

describe('validateAnswer', () => {
  it('앞뒤 공백을 지우고 통과한다', () => {
    expect(validateAnswer({ text: '  1층 수거함에 버리면 돼요  ' })).toEqual({
      ok: true,
      value: { text: '1층 수거함에 버리면 돼요' },
    });
  });

  it.each(['', '   ', '\n\t'])('비어 있으면 거절한다: %j', (text) => {
    expect(validateAnswer({ text }).ok).toBe(false);
  });

  it(`${ANSWER_MAX}자까지 허용하고 넘으면 거절한다 (공백을 지운 뒤 센다)`, () => {
    expect(validateAnswer({ text: '가'.repeat(ANSWER_MAX) }).ok).toBe(true);
    expect(validateAnswer({ text: '가'.repeat(ANSWER_MAX + 1) }).ok).toBe(false);
    expect(validateAnswer({ text: ` ${'가'.repeat(ANSWER_MAX)} ` }).ok).toBe(true);
  });

  it.each([null, 'text', [], { text: 42 }, {}])('형식이 틀리면 거절한다: %j', (input) => {
    expect(validateAnswer(input).ok).toBe(false);
  });

  it('거절할 때는 화면에 띄울 문장을 준다', () => {
    const result = validateAnswer({ text: '' });
    expect(!result.ok && result.error.length > 0).toBe(true);
  });
});
