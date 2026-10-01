import { describe, it, expect } from 'vitest';
import { isDone, parseDone, progressPercent, splitByDone, toggleDoneIds } from '@/lib/progress';
import type { MatchedTask } from '@/lib/types';

function task(id: string): MatchedTask {
  return {
    id,
    title: id,
    why: '',
    howTo: '',
    category: 'LIFE',
    linkUrl: null,
    placeName: null,
    placeAddress: null,
    placePhone: null,
    daysLeft: null,
    overdue: false,
    stale: false,
    verifiedAt: '2026-09-01T00:00:00.000Z',
  };
}

describe('parseDone', () => {
  it('저장된 id 배열을 읽는다', () => {
    expect(parseDone('["a","b"]')).toEqual(['a', 'b']);
  });

  it('저장된 게 없으면 빈 배열이다', () => {
    expect(parseDone(null)).toEqual([]);
    expect(parseDone('')).toEqual([]);
  });

  // 시크릿 창 · 직접 수정 · 이전 버전이 남긴 값. 어떤 경우에도 앱이 멈추면 안 된다.
  it('깨진 JSON 이면 빈 배열이다', () => {
    expect(parseDone('{not json')).toEqual([]);
  });

  it('배열이 아닌 값이면 빈 배열이다', () => {
    expect(parseDone('{"a":1}')).toEqual([]);
    expect(parseDone('"a"')).toEqual([]);
    expect(parseDone('null')).toEqual([]);
  });

  it('문자열이 아닌 원소는 걸러낸다', () => {
    expect(parseDone('["a",1,null,{"x":1},"b"]')).toEqual(['a', 'b']);
  });
});

describe('toggleDoneIds', () => {
  it('없던 id 는 넣는다', () => {
    expect(toggleDoneIds(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('있던 id 는 뺀다', () => {
    expect(toggleDoneIds(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('두 번 누르면 원래대로 돌아온다', () => {
    expect(toggleDoneIds(toggleDoneIds(['a'], 'b'), 'b')).toEqual(['a']);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const original = ['a'];
    toggleDoneIds(original, 'b');
    expect(original).toEqual(['a']);
  });
});

describe('isDone', () => {
  it('목록에 있으면 완료다', () => {
    expect(isDone('a', ['a'])).toBe(true);
    expect(isDone('b', ['a'])).toBe(false);
  });
});

describe('splitByDone', () => {
  it('해야 할 일과 끝낸 일로 가른다', () => {
    const { todo, done } = splitByDone([task('a'), task('b'), task('c')], ['b']);
    expect(todo.map((t) => t.id)).toEqual(['a', 'c']);
    expect(done.map((t) => t.id)).toEqual(['b']);
  });

  it('각자 받은 순서를 유지한다', () => {
    const { done } = splitByDone([task('a'), task('b'), task('c')], ['c', 'a']);
    expect(done.map((t) => t.id)).toEqual(['a', 'c']);
  });

  // 프로필을 바꾸거나 운영자가 항목을 내리면 이번 응답에 없는 id 가 남는다.
  // 그걸 세면 "3건 중 4건 완료" 가 나온다.
  it('이번 목록에 없는 완료 id 는 어느 쪽에도 넣지 않는다', () => {
    const { todo, done } = splitByDone([task('a')], ['a', 'gone']);
    expect(todo).toEqual([]);
    expect(done.map((t) => t.id)).toEqual(['a']);
  });

  it('아무것도 안 끝냈으면 전부 해야 할 일이다', () => {
    const { todo, done } = splitByDone([task('a'), task('b')], []);
    expect(todo).toHaveLength(2);
    expect(done).toEqual([]);
  });
});

describe('progressPercent', () => {
  it('비율을 반올림한 정수로 돌려준다', () => {
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(2, 3)).toBe(67);
    expect(progressPercent(3, 3)).toBe(100);
  });

  it('전체가 0건이면 0 이다', () => {
    expect(progressPercent(0, 0)).toBe(0);
  });
});
