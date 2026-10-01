import { describe, it, expect } from 'vitest';
import { CATEGORY_ORDER, groupByCategory, pickUrgent } from '@/lib/taskGroups';
import type { MatchedTask, TaskCategory } from '@/lib/types';

function task(id: string, category: TaskCategory, daysLeft: number | null): MatchedTask {
  return {
    id,
    title: id,
    why: '',
    howTo: '',
    category,
    linkUrl: null,
    placeName: null,
    placeAddress: null,
    placePhone: null,
    daysLeft,
    overdue: daysLeft !== null && daysLeft < 0,
    stale: false,
    verifiedAt: '2026-09-01T00:00:00.000Z',
  };
}

describe('pickUrgent', () => {
  it('기한이 가장 가까운 것을 고른다', () => {
    const tasks = [task('a', 'ADMIN', 9), task('b', 'HOUSING', 3), task('c', 'LIFE', 20)];
    expect(pickUrgent(tasks)?.id).toBe('b');
  });

  // 지난 것이 가장 급하다. 하루 더 두면 과태료가 커진다.
  it('지난 것이 있으면 가장 많이 지난 것을 고른다', () => {
    const tasks = [task('a', 'ADMIN', -16), task('b', 'HOUSING', 3), task('c', 'LIFE', -2)];
    expect(pickUrgent(tasks)?.id).toBe('a');
  });

  it('기한 없는 항목은 후보가 아니다', () => {
    const tasks = [task('a', 'LIFE', null), task('b', 'HOUSING', 7)];
    expect(pickUrgent(tasks)?.id).toBe('b');
  });

  it('전부 기한이 없으면 null 이다', () => {
    expect(pickUrgent([task('a', 'LIFE', null), task('b', 'WASTE', null)])).toBeNull();
  });

  it('목록이 비면 null 이다', () => {
    expect(pickUrgent([])).toBeNull();
  });
});

describe('groupByCategory', () => {
  it('정해진 순서대로 묶는다', () => {
    const tasks = [task('a', 'LIFE', 1), task('b', 'ADMIN', 2), task('c', 'WASTE', 3)];
    expect(groupByCategory(tasks).map((g) => g.category)).toEqual(['ADMIN', 'WASTE', 'LIFE']);
  });

  // 할 일이 3건인데 빈 제목이 4개 뜨면 더 허전해 보인다.
  it('빈 카테고리는 내보내지 않는다', () => {
    expect(groupByCategory([task('a', 'ADMIN', 1)])).toHaveLength(1);
  });

  it('묶음 안에서는 받은 순서를 그대로 둔다', () => {
    const tasks = [task('a', 'ADMIN', 1), task('b', 'ADMIN', 5), task('c', 'ADMIN', 3)];
    expect(groupByCategory(tasks)[0].tasks.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('모든 카테고리가 순서에 들어 있다', () => {
    expect([...CATEGORY_ORDER].sort()).toEqual(['ADMIN', 'HOUSING', 'LIFE', 'WASTE']);
  });
});
