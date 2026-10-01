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

/*
 * 아래 셋은 `useSyncExternalStore` 용이다.
 *
 * localStorage 를 effect 안에서 읽어 setState 하면 렌더가 한 번 더 돌고,
 * 그 사이 화면이 "프로필 없음" 상태로 한 번 그려진다. React 19 는 이 패턴을
 * 린트 에러로 잡는다. 외부 저장소는 외부 저장소로 구독하는 게 맞다.
 */

/** 다른 탭에서 프로필을 바꾸면 이 탭도 따라간다. */
export function subscribeProfile(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/**
 * 스냅샷은 파싱하기 전 문자열이어야 한다.
 * 객체를 돌려주면 호출할 때마다 새 참조가 나와서 `useSyncExternalStore` 가
 * 값이 계속 바뀌는 것으로 보고 무한 루프에 빠진다.
 */
export function getProfileSnapshot(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** 서버에는 localStorage 가 없다. 서버 렌더 결과는 항상 "프로필 없음"이다. */
export function getProfileServerSnapshot(): string | null {
  return null;
}

/** 문자열 스냅샷을 Profile 로. 깨진 JSON 이 남아 있어도 앱이 멈추지 않게 한다. */
export function parseProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}
