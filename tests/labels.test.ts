import { describe, it, expect } from 'vitest';
import { asOfLabel, dueLabel } from '@/lib/labels';
import type { MatchedTask } from '@/lib/types';

/** 기한 관련 필드만 바꿔 끼우는 최소 할 일. 나머지 값은 판정에 안 쓰인다. */
function task(partial: Partial<MatchedTask>): MatchedTask {
  return {
    id: 't1',
    title: '전입신고',
    why: '안 하면 과태료',
    howTo: '주민센터 방문',
    category: 'ADMIN',
    linkUrl: null,
    placeName: null,
    placeAddress: null,
    placePhone: null,
    daysLeft: null,
    overdue: false,
    stale: false,
    verifiedAt: '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

describe('dueLabel', () => {
  it('기한이 없으면 기한 없음이다', () => {
    expect(dueLabel(task({ daysLeft: null }))).toEqual({ text: '기한 없음', tone: 'none' });
  });

  it('남은 날이 있으면 며칠 남았는지 말한다', () => {
    expect(dueLabel(task({ daysLeft: 11 }))).toEqual({ text: '11일 남음', tone: '' });
  });

  // 0을 "0일 남음"으로 찍으면 안 해도 되는 것처럼 읽힌다.
  it('당일이면 오늘까지이고 경고 톤이다', () => {
    expect(dueLabel(task({ daysLeft: 0 }))).toEqual({ text: '오늘까지', tone: 'overdue' });
  });

  it('기한이 지나면 며칠 지났는지 양수로 말한다', () => {
    expect(dueLabel(task({ daysLeft: -3 }))).toEqual({ text: '기한 3일 지남', tone: 'overdue' });
  });
});

describe('asOfLabel', () => {
  it('확인일을 연 · 월로 줄여 쓴다', () => {
    expect(asOfLabel('2026-09-01T00:00:00.000Z')).toBe('2026년 9월 기준');
  });

  // UTC 자정을 로컬 시간으로 읽으면 한국에서는 전날로 밀려 작년 12월이 된다.
  it('UTC 자정이 로컬 시간대 때문에 전달로 밀리지 않는다', () => {
    expect(asOfLabel('2026-01-01T00:00:00.000Z')).toBe('2026년 1월 기준');
  });
});
