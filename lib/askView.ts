/**
 * 질문 화면이 응답을 받았을 때 무엇을 보여줄지 정한다.
 *
 * 화면이 `answer`·`confidence`·`mode` 조합을 직접 해석하면, 근거 없는 문장이
 * 화면에 새어 나가는 분기를 놓치기 쉽다. 판정을 여기 한곳에 모으고 단위 테스트한다.
 * 순수 함수만 둔다.
 */

import type { AskProfile, AskResponse, Profile } from '@/lib/types';

/** `/api/ask` 가 받는 최대 길이. 서버(`app/api/ask/route.ts`)의 검사와 같은 값이어야 한다. */
export const ASK_MAX_LENGTH = 1000;

export type AnswerView =
  /** AI 문장을 보여준다. 서버가 근거 id 를 확인한 경우만 */
  | { kind: 'answer'; confidence: 'GROUNDED' | 'PARTIAL'; text: string }
  /**
   * 확인된 근거 없이 키워드로 찾은 카드만 보여준다.
   * AI 가 꺼졌거나 실패했을 때, 그리고 AI 가 "모름"이라고 판단했을 때(#48) 둘 다 여기로 온다.
   * 응답으로는 둘을 구분할 수 없어서 화면 문구는 양쪽에 다 맞아야 한다.
   */
  | { kind: 'fallback' }
  /** 보여줄 문장도 카드도 없다 — "아직 아무도 확인하지 않았습니다" */
  | { kind: 'unknown' };

/**
 * 응답 → 화면 종류.
 *
 * AI 문장은 `confidence` 가 GROUNDED · PARTIAL 이고 `answer` 가 있을 때만 쓴다.
 * 서버 계약상 UNKNOWN 이면 `answer` 가 null 이지만, 계약이 깨져 문장이 실려 와도
 * 여기서 한 번 더 버린다. 근거 없는 문장을 화면에 띄우지 않는 마지막 자리다.
 */
export function describeAnswer(res: AskResponse): AnswerView {
  const text = res.answer?.trim();
  if (text && (res.confidence === 'GROUNDED' || res.confidence === 'PARTIAL')) {
    return { kind: 'answer', confidence: res.confidence, text };
  }
  if (res.mode === 'FALLBACK' && res.tasks.length > 0) {
    return { kind: 'fallback' };
  }
  return { kind: 'unknown' };
}

/**
 * 질문과 함께 보낼 상황 정보. 무엇을 어디에 쓰는지는 `AskProfile` 주석에 있다.
 *
 * 차량 · 반려동물 · 학생 여부는 서버가 할 일을 거르는 데 필요해서 보낸다. 빼면 원룸 사용자에게
 * 기숙사 전용 카드가 나가는 식으로 내 상황과 맞지 않는 카드가 섞인다.
 * 구역은 쓰는 곳이 없어서 보내지 않는다.
 */
export function askProfile(profile: Profile): AskProfile {
  return {
    housingType: profile.housingType,
    contractType: profile.contractType,
    moveInDate: profile.moveInDate,
    hasCar: profile.hasCar,
    hasPet: profile.hasPet,
    isStudent: profile.isStudent,
  };
}

/**
 * 질문이 실제로 Google(Gemini)로 나가는가. 질문 화면의 고지 문구가 이 값으로 갈린다.
 *
 * `/api/ask` 는 스위치(`GEMINI_ALLOW_USER_INPUT=true`)가 켜졌을 때만 Gemini 를 부르고,
 * `askGemini` 는 키가 비어 있으면 요청을 보내지 않는다. 둘 다 있어야 전송된다.
 * 고지는 실제 동작과 같아야 한다 — 안 보내면서 보낸다고 하거나, 보내면서 말하지 않으면 안 된다.
 */
export function sendsQuestionsToGoogle(env: { GEMINI_ALLOW_USER_INPUT?: string; GEMINI_API_KEY?: string }): boolean {
  return env.GEMINI_ALLOW_USER_INPUT === 'true' && Boolean(env.GEMINI_API_KEY?.trim());
}

/**
 * '이웃의 질문'에 올라간 내 질문을 다시 보러 가는 길.
 * 로그인해서 쓴 질문은 "내 질문" 탭에 모이므로 그쪽으로, 아니면 답을 기다리는 질문 탭의 그 자리로.
 */
export function onBoardLink(questionId: string, loggedIn: boolean): { href: string; label: string } {
  return loggedIn
    ? { href: `/questions?status=MINE#q-${questionId}`, label: '내 질문에서 보기' }
    : { href: `/questions?status=OPEN#q-${questionId}`, label: '이웃의 질문에서 보기' };
}
