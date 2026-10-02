/**
 * 할 일 완료 체크.
 *
 * 로그인이 없으므로 완료한 할 일의 id 목록은 브라우저 localStorage 에만 저장한다.
 * 서버에는 보내지 않는다 — 누가 뭘 끝냈는지는 서버가 알 필요가 없다.
 *
 * 위쪽 순수 함수가 판정이고 단위 테스트 대상이다. 아래쪽은 localStorage 를 만지는 껍데기다.
 */

import type { MatchedTask } from '@/lib/types';

const KEY = 'wolgye.done.v1';

/** 같은 탭에서 바뀐 걸 알리는 이벤트. `storage` 이벤트는 다른 탭에서만 발생한다. */
const CHANGE_EVENT = 'wolgye:done-change';

/**
 * 저장된 문자열을 id 배열로.
 *
 * 깨진 JSON, 배열이 아닌 값, 문자열이 아닌 원소가 섞여 있어도 앱이 멈추면 안 된다.
 * 사용자가 개발자 도구로 직접 고칠 수도 있고, 이전 버전이 다른 모양으로 저장했을 수도 있다.
 */
export function parseDone(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

/** 있으면 빼고 없으면 넣는다. 원본 배열은 건드리지 않는다. */
export function toggleDoneIds(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export function isDone(id: string, ids: string[]): boolean {
  return ids.includes(id);
}

export interface SplitTasks {
  todo: MatchedTask[];
  done: MatchedTask[];
}

/**
 * 해야 할 일과 끝낸 일로 가른다. 각자 받은 순서(기한순)를 유지한다.
 *
 * 완료 목록에는 있는데 이번 응답에는 없는 id 가 있을 수 있다. 프로필을 바꿨거나 운영자가
 * 항목을 내렸을 때다. 그런 id 는 어느 쪽에도 안 넣는다 — 안 보이는 항목을 세면
 * "3건 중 4건 완료" 같은 숫자가 나온다.
 */
export function splitByDone(tasks: MatchedTask[], ids: string[]): SplitTasks {
  const doneSet = new Set(ids);
  return {
    todo: tasks.filter((task) => !doneSet.has(task.id)),
    done: tasks.filter((task) => doneSet.has(task.id)),
  };
}

/** 진행률. 전체가 0건이면 0% 로 둔다 (0 으로 나누지 않는다). */
export function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

/* ---------- localStorage 껍데기 (브라우저 전용) ---------- */

export function subscribeDone(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** 스냅샷은 파싱 전 문자열이어야 한다. 배열을 돌려주면 매번 새 참조라 무한 루프에 빠진다. */
export function getDoneSnapshot(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function getDoneServerSnapshot(): string | null {
  return null;
}

/**
 * 완료 상태를 뒤집어 저장한다.
 *
 * 저장이 막힌 환경(시크릿 창 등)에서는 쓰기가 실패한다. 이때는 조용히 넘어가지만
 * 화면은 안 바뀐다 — 눌렀는데 반응이 없는 것이라 호출한 쪽이 알 수 있게 성공 여부를 돌려준다.
 */
export function toggleDone(id: string): boolean {
  try {
    const next = toggleDoneIds(parseDone(localStorage.getItem(KEY)), id);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}
