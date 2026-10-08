'use client';

import { useSyncExternalStore } from 'react';
import type { MeResponse, SessionUser } from '@/lib/types';

/**
 * 지금 로그인한 사람. 화면 여러 곳(제호 · 답변 양식)이 같은 값을 보도록 모듈 하나에 둔다.
 *
 * `loaded` 가 false 면 "로그인 안 함"이 아니라 "아직 모름"이다. 이걸 구분하지 않으면
 * 로그인한 사람에게도 "로그인하세요"가 한 번 깜빡인다.
 * 세션 자체는 httpOnly 쿠키라 화면이 읽을 수 없고, /api/auth/me 로만 확인한다.
 */
export type SessionState = { loaded: boolean; user: SessionUser | null };

const UNKNOWN: SessionState = { loaded: false, user: null };

let state: SessionState = UNKNOWN;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: SessionState) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** 서버에 다시 묻는다. 로그인 · 가입 · 로그아웃 직후에는 `force` 로 새로 읽는다. */
export function loadSession(force = false): Promise<void> {
  if (inflight && !force) return inflight;
  inflight = fetch('/api/auth/me', { cache: 'no-store' })
    .then((res) => (res.ok ? (res.json() as Promise<MeResponse>) : { user: null }))
    .then((body) => emit({ loaded: true, user: body.user ?? null }))
    // 확인을 못 하면 비로그인으로 본다. 보기 화면은 로그인 없이도 전부 동작한다.
    .catch(() => emit({ loaded: true, user: null }));
  return inflight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!state.loaded) void loadSession();
  return () => {
    listeners.delete(listener);
  };
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => UNKNOWN,
  );
}

/** 로그아웃. 서버가 쿠키를 지우고 나면 화면 상태도 비로그인으로. */
export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
  inflight = null;
  emit({ loaded: true, user: null });
}
