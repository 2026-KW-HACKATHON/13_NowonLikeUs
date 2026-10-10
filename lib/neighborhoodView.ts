import type { PositionCheck } from './neighborhood';
import type { QuestionItem } from './types';

/*
 * 노원 동네 인증 화면 문구. 판정 자체는 lib/neighborhood.ts(희태), 여기는 결과를 사람 말로 바꾸는 일만 한다.
 *
 * 인증은 선택이다. 실패해도 답변 · 맞아요는 그대로 되므로, 문구에서 "못 한다"는 느낌을 주지 않는다.
 */

/** 인증 버튼을 누른 뒤 나올 수 있는 결과. 판정 셋 + 브라우저 위치 오류 셋 + 저장 실패. */
export type NeighborhoodOutcome = PositionCheck | 'denied' | 'timeout' | 'unavailable' | 'failed';

/**
 * 브라우저 위치 오류(GeolocationPositionError.code) → 결과.
 * 1 권한 거부 · 3 시간 초과 · 그 밖(2 위치 못 찾음, 모르는 값)은 'unavailable'.
 */
export function geoErrorOutcome(code: number): NeighborhoodOutcome {
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'unavailable';
}

/** 결과별 안내. `ok` 는 인증이 끝났다는 뜻(초록), 나머지는 다시 해 볼 수 있다는 안내. */
export function neighborhoodMessage(outcome: NeighborhoodOutcome): { ok: boolean; text: string } {
  switch (outcome) {
    case 'inside':
      return { ok: true, text: '노원 인증을 마쳤습니다. 내 답변 옆에 "노원 인증"이 붙습니다. 180일이 지나면 다시 인증해 주세요.' };
    case 'outside':
      return { ok: false, text: '지금 위치가 노원구 밖으로 나옵니다. 노원구 안에 있을 때 다시 눌러 주세요.' };
    case 'inaccurate':
      return {
        ok: false,
        text: '위치가 정확하게 잡히지 않아 확인하지 못했습니다. 휴대폰의 위치(GPS)를 켜고, 실외나 창가에서 다시 눌러 주세요.',
      };
    case 'denied':
      return {
        ok: false,
        text: '위치 권한이 꺼져 있습니다. 브라우저 설정에서 이 사이트의 위치 권한을 허용한 뒤 다시 눌러 주세요.',
      };
    case 'timeout':
      return { ok: false, text: '위치를 찾는 데 시간이 너무 오래 걸렸습니다. 잠시 후 다시 눌러 주세요.' };
    case 'unavailable':
      return { ok: false, text: '이 기기나 브라우저에서는 위치를 확인할 수 없습니다. 인증 없이도 답변은 그대로 남길 수 있습니다.' };
    case 'failed':
      return { ok: false, text: '인증을 저장하지 못했습니다. 잠시 후 다시 눌러 주세요.' };
  }
}

/**
 * 인증 · 인증 지우기 직후의 목록. 화면에 떠 있는 "내 답변"의 배지만 바로 맞춘다.
 * 다른 사람 답변은 건드리지 않는다. 바뀐 게 없으면 같은 배열을 그대로 돌려준다.
 */
export function withMyNeighborhood(questions: QuestionItem[], verified: boolean): QuestionItem[] {
  let changed = false;
  const next = questions.map((q) => {
    if (!q.answers.some((a) => a.authoredByMe && a.authorNeighborhoodVerified !== verified)) return q;
    changed = true;
    return {
      ...q,
      answers: q.answers.map((a) => (a.authoredByMe ? { ...a, authorNeighborhoodVerified: verified } : a)),
    };
  });
  return changed ? next : questions;
}
