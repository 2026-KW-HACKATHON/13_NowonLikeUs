import { describe, it, expect } from 'vitest';
import { askProfile, describeAnswer, onBoardLink, sendsQuestionsToGoogle } from '@/lib/askView';

describe('onBoardLink', () => {
  it('로그인했으면 내 질문 탭의 그 질문으로', () => {
    expect(onBoardLink('q1', true)).toEqual({ href: '/questions?status=MINE#q-q1', label: '내 질문에서 보기' });
  });

  it('비로그인이면 답을 기다리는 질문 탭의 그 질문으로', () => {
    expect(onBoardLink('q1', false)).toEqual({ href: '/questions?status=OPEN#q-q1', label: '이웃의 질문에서 보기' });
  });
});
import { matchesProfile } from '@/lib/matching';
import type { AskResponse, MatchedTask, Profile, TaskConditions } from '@/lib/types';

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
    hasPet: false,
    isStudent: true,
  };

  it('거르기에 필요한 값과 이사일을 보낸다', () => {
    expect(askProfile(profile)).toEqual({
      housingType: 'ONE_ROOM',
      contractType: 'MONTHLY',
      moveInDate: '2026-09-20',
      hasCar: true,
      hasPet: false,
      isStudent: true,
    });
  });

  it('쓰는 곳이 없는 구역은 보내지 않는다', () => {
    expect(Object.keys(askProfile(profile))).not.toContain('zone');
  });

  // 서버는 받은 값으로 matchesProfile 을 돌린다. 보낸 값만으로 목록 화면과 같은 판정이 나와야
  // 질문 결과와 할 일 목록이 서로 다른 카드를 보여주지 않는다. 필드가 빠지면 여기서 걸린다.
  it('보낸 값만으로 목록 화면과 같은 필터 판정이 나온다', () => {
    const sent = { ...askProfile(profile), zone: '' };
    const conditions: TaskConditions[] = [
      { housingTypes: ['DORM'], contractTypes: [], requiresCar: false, requiresPet: false, studentOnly: false },
      { housingTypes: [], contractTypes: ['JEONSE'], requiresCar: false, requiresPet: false, studentOnly: false },
      { housingTypes: [], contractTypes: [], requiresCar: true, requiresPet: false, studentOnly: false },
      { housingTypes: [], contractTypes: [], requiresCar: false, requiresPet: true, studentOnly: false },
      { housingTypes: [], contractTypes: [], requiresCar: false, requiresPet: false, studentOnly: true },
      { housingTypes: ['ONE_ROOM'], contractTypes: ['MONTHLY'], requiresCar: false, requiresPet: false, studentOnly: false },
    ];
    for (const c of conditions) {
      expect(matchesProfile(c, sent)).toBe(matchesProfile(c, profile));
    }
  });
});

describe('sendsQuestionsToGoogle', () => {
  // 고지 문구가 실제 전송 여부와 어긋나면 안 된다. 서버(/api/ask · askGemini)와 같은 조건이어야 한다.
  it('스위치가 true 이고 키가 있을 때만 전송한다', () => {
    expect(sendsQuestionsToGoogle({ GEMINI_ALLOW_USER_INPUT: 'true', GEMINI_API_KEY: 'k' })).toBe(true);
  });

  it.each([
    [{ GEMINI_ALLOW_USER_INPUT: 'false', GEMINI_API_KEY: 'k' }],
    [{ GEMINI_ALLOW_USER_INPUT: 'TRUE', GEMINI_API_KEY: 'k' }],
    [{ GEMINI_ALLOW_USER_INPUT: '1', GEMINI_API_KEY: 'k' }],
    [{ GEMINI_API_KEY: 'k' }],
  ])('스위치가 정확히 "true" 가 아니면 전송 X: %j', (env) => {
    expect(sendsQuestionsToGoogle(env)).toBe(false);
  });

  it.each(['', '   ', undefined])('키가 비어 있으면 전송 X (askGemini 가 요청을 안 보냄): %j', (key) => {
    expect(sendsQuestionsToGoogle({ GEMINI_ALLOW_USER_INPUT: 'true', GEMINI_API_KEY: key })).toBe(false);
  });
});
