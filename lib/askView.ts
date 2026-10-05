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
 * 질문과 함께 보낼 상황 정보.
 *
 * 서버가 쓰는 건 주거형태 · 계약형태(질문 상황으로 저장)와 이사일(카드 기한 계산)뿐이다.
 * 구역 · 차량 · 반려동물 · 학생 여부는 보내지 않는다. 쓰지 않는 개인정보는 애초에 내보내지 않는다.
 */
export function askProfile(profile: Profile): AskProfile {
  return {
    housingType: profile.housingType,
    contractType: profile.contractType,
    moveInDate: profile.moveInDate,
  };
}
