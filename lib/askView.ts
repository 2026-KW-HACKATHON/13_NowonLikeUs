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
  /** AI 없이 키워드로 찾은 카드만 보여준다 */
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
