'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  getDoneServerSnapshot,
  getDoneSnapshot,
  parseDone,
  subscribeDone,
} from '@/lib/progress';

/**
 * 완료한 할 일의 id 목록.
 *
 * 서버 렌더와 하이드레이션 직전에는 빈 배열이다. 이때 "아무것도 안 끝냄"으로 그려졌다가
 * 곧 바뀌므로, 완료 여부에 따라 레이아웃이 크게 달라지는 화면은 `useProfile` 의
 * `hydrated` 가 true 가 된 뒤에 그려야 깜빡이지 않는다.
 */
export function useDone(): string[] {
  const raw = useSyncExternalStore(subscribeDone, getDoneSnapshot, getDoneServerSnapshot);
  // raw 가 그대로면 같은 배열을 돌려준다. 매번 새로 파싱하면 effect 의존성이 계속 바뀐다.
  return useMemo(() => parseDone(raw), [raw]);
}
