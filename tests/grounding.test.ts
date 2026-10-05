import { describe, expect, it } from 'vitest';

import { groundAnswer, verifyGrounding } from '@/lib/grounding';

const known = new Set(['task:a', 'task:b']);

describe('groundAnswer', () => {
  it.each([
    '14일 안에 신고하세요.',
    '방 번호: 이사일',
    '이번 주소 변경은 관련 문서를 확인하세요.',
  ])('AI 문구와 무관하게 서버의 고정 안내만 사용한다: %s', (answer) => {
    expect(groundAnswer({ answer, sourceIds: ['task:a'], confidence: 'GROUNDED' }, known).answer)
      .toBe('관련 항목의 원문 카드를 확인해 주세요.');
  });
  it.each([
    { sourceIds: ['task:a'], confidence: 'UNKNOWN' as const },
    { sourceIds: ['task:fake'], confidence: 'GROUNDED' as const },
    { sourceIds: [], confidence: 'GROUNDED' as const },
    { sourceIds: ['task:fake'], confidence: 'PARTIAL' as const },
  ])('최종 UNKNOWN이면 원문 답변을 차단한다: %j', (ai) => {
    const result = groundAnswer({ ...ai, answer: '근거 없는 안내입니다.' }, known);

    expect(result.confidence).toBe('UNKNOWN');
    expect(result.answer).toBeNull();
    expect(result.validSourceIds).toEqual([]);
  });

  it('검증된 GROUNDED 근거에는 서버의 고정 안내를 붙인다', () => {
    expect(groundAnswer({
      answer: '모델이 만든 GROUNDED 안내입니다.',
      sourceIds: ['task:a'],
      confidence: 'GROUNDED',
    }, known)).toEqual({
      answer: '관련 항목의 원문 카드를 확인해 주세요.',
      confidence: 'GROUNDED',
      validSourceIds: ['task:a'],
      droppedSourceIds: [],
    });
  });

  it('PARTIAL로 강등되면 고정 안내와 실제 근거만 유지한다', () => {
    expect(groundAnswer({
      answer: '모델이 만든 PARTIAL 안내입니다.',
      sourceIds: ['task:a', 'task:fake'],
      confidence: 'GROUNDED',
    }, known)).toEqual({
      answer: '관련 항목의 원문 카드를 확인해 주세요.',
      confidence: 'PARTIAL',
      validSourceIds: ['task:a'],
      droppedSourceIds: ['task:fake'],
    });
  });
});

describe('verifyGrounding', () => {
  it('근거가 전부 실재하면 AI 신뢰도를 그대로 쓴다', () => {
    const result = verifyGrounding(['task:a'], known, 'GROUNDED');

    expect(result.confidence).toBe('GROUNDED');
    expect(result.validSourceIds).toEqual(['task:a']);
    expect(result.droppedSourceIds).toEqual([]);
  });

  it('허구 id가 섞이면 PARTIAL로 강등한다', () => {
    const result = verifyGrounding(
      ['task:a', 'task:zzz'],
      known,
      'GROUNDED',
    );

    expect(result.confidence).toBe('PARTIAL');
    expect(result.validSourceIds).toEqual(['task:a']);
    expect(result.droppedSourceIds).toEqual(['task:zzz']);
  });

  it('근거가 전부 허구면 UNKNOWN으로 강등한다', () => {
    const result = verifyGrounding(['task:zzz'], known, 'GROUNDED');

    expect(result.confidence).toBe('UNKNOWN');
    expect(result.validSourceIds).toEqual([]);
    expect(result.droppedSourceIds).toEqual(['task:zzz']);
  });

  it('근거를 아예 안 달았으면 UNKNOWN이다', () => {
    expect(verifyGrounding([], known, 'GROUNDED')).toEqual({
      confidence: 'UNKNOWN',
      validSourceIds: [],
      droppedSourceIds: [],
    });
  });

  it('AI가 UNKNOWN이라 했으면 근거가 실재해도 UNKNOWN이다', () => {
    const result = verifyGrounding(['task:a'], known, 'UNKNOWN');

    expect(result.confidence).toBe('UNKNOWN');
    expect(result.validSourceIds).toEqual([]);
    expect(result.droppedSourceIds).toEqual([]);
  });

  it('AI가 PARTIAL이라 했으면 근거가 실재해도 PARTIAL을 유지한다', () => {
    expect(verifyGrounding(['task:a'], known, 'PARTIAL').confidence).toBe(
      'PARTIAL',
    );
  });

  it('중복된 근거 id는 한 번만 센다', () => {
    const result = verifyGrounding(
      ['task:a', 'task:a', 'task:zzz', 'task:zzz'],
      known,
      'GROUNDED',
    );

    expect(result.validSourceIds).toEqual(['task:a']);
    expect(result.droppedSourceIds).toEqual(['task:zzz']);
  });
});
