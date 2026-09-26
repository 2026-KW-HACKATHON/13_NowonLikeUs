import type { Profile } from './types';

const KEY = 'wolgye.profile.v1';

/**
 * 시크릿 창이나 사이트 데이터가 차단된 환경에서는 localStorage 접근이 예외를 던진다.
 * 프로필이 없어도 앱이 렌더되어야 하므로 전부 try/catch 로 감싼다.
 */
export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // 저장에 실패해도 현재 세션 진행은 막지 않는다.
  }
}

export function clearProfile(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시한다.
  }
}
