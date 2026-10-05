import { describe, it, expect } from 'vitest';
import { askProfile, describeAnswer } from '@/lib/askView';
import type { AskResponse, MatchedTask, Profile } from '@/lib/types';

const card: MatchedTask = {
  id: 't1',
  title: '전입신고 하기',
  why: '',
  howTo: '',
  category: 'ADMIN',
  linkUrl: null,
  placeName: null,
  placeAddress: null,
  placePhone: null,
  daysLeft: 3,
  overdue: false,
  stale: false,
  verifiedAt: '2026-09-26T00:00:00.000Z',
};

function res(partial: Partial<AskResponse>): AskResponse {
  return { mode: 'AI', answer: null, confidence: 'UNKNOWN', tasks: [], questionId: 'q1', ...partial };
}

describe('describeAnswer', () => {
  it('근거가 확인된 AI 문장은 보여준다', () => {
    expect(describeAnswer(res({ answer: '전입신고 항목을 확인해 보세요.', confidence: 'GROUNDED', tasks: [card] })))
      .toEqual({ kind: 'answer', confidence: 'GROUNDED', text: '전입신고 항목을 확인해 보세요.' });
  });

  it('일부만 확인된 AI 문장도 보여주되 PARTIAL 로 구분한다', () => {
    expect(describeAnswer(res({ answer: '관련 항목을 확인해 주세요.', confidence: 'PARTIAL' })))
      .toEqual({ kind: 'answer', confidence: 'PARTIAL', text: '관련 항목을 확인해 주세요.' });
  });

  // 서버 계약상 일어나면 안 되지만, 깨져서 실려 와도 근거 없는 문장은 화면에 띄우지 않는다.
  it('UNKNOWN 인데 문장이 실려 오면 버린다', () => {
    expect(describeAnswer(res({ answer: '아마 14일일 거예요.', confidence: 'UNKNOWN' })))
      .toEqual({ kind: 'unknown' });
  });

  it('공백뿐인 문장은 답이 아니다', () => {
    expect(describeAnswer(res({ answer: '   ', confidence: 'GROUNDED' }))).toEqual({ kind: 'unknown' });
  });

  it('AI 없이 키워드로 찾은 카드가 있으면 폴백 화면이다', () => {
    expect(describeAnswer(res({ mode: 'FALLBACK', tasks: [card] }))).toEqual({ kind: 'fallback' });
  });

  it('폴백인데 카드도 없으면 모르는 것이다', () => {
    expect(describeAnswer(res({ mode: 'FALLBACK', tasks: [] }))).toEqual({ kind: 'unknown' });
  });

  // #26 의 현재 동작: AI 가 UNKNOWN 이면 mode 는 AI, 카드는 빈 배열.
  it('AI 가 모른다고 하면 모르는 것이다', () => {
    expect(describeAnswer(res({ mode: 'AI', confidence: 'UNKNOWN', tasks: [] }))).toEqual({ kind: 'unknown' });
  });
});

describe('askProfile', () => {
  const profile: Profile = {
    zone: '월계1동',
    housingType: 'ONE_ROOM',
    contractType: 'MONTHLY',
    moveInDate: '2026-09-20',
    hasCar: true,
    hasPet: true,
    isStudent: true,
  };

  it('주거형태 · 계약형태 · 이사일만 보낸다', () => {
    expect(askProfile(profile)).toEqual({
      housingType: 'ONE_ROOM',
      contractType: 'MONTHLY',
      moveInDate: '2026-09-20',
    });
  });

  it('구역 · 차량 · 반려동물 · 학생 여부는 보내지 않는다', () => {
    const keys = Object.keys(askProfile(profile));
    for (const field of ['zone', 'hasCar', 'hasPet', 'isStudent']) {
      expect(keys).not.toContain(field);
    }
  });
});
