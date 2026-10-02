'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  getProfileServerSnapshot,
  getProfileSnapshot,
  parseProfile,
  subscribeProfile,
} from '@/lib/profile';
import type { Profile } from '@/lib/types';

/**
 * 브라우저에 저장된 프로필을 읽는다.
 *
 * `hydrated` 는 "브라우저에서 한 번 읽었다"는 뜻이다. 서버 렌더와 하이드레이션 직전에는
 * false 이고, 이때 profile 이 null 인 것은 "프로필이 없다"가 아니라 "아직 모른다"이다.
 * 이걸 구분하지 않으면 프로필이 있는 사람도 /setup 으로 한 번 튕긴다.
 */
export function useProfile(): { hydrated: boolean; profile: Profile | null } {
  const raw = useSyncExternalStore(
    subscribeProfile,
    getProfileSnapshot,
    getProfileServerSnapshot,
  );
  const hydrated = useSyncExternalStore(
    subscribeProfile,
    () => true,
    () => false,
  );

  // raw 가 그대로면 같은 객체를 돌려준다. 매번 새로 파싱하면 effect 의존성이 계속 바뀐다.
  const profile = useMemo(() => parseProfile(raw), [raw]);

  return { hydrated, profile };
}
