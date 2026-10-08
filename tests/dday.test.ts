import { describe, it, expect } from 'vitest';
import { daysUntilDue, isOverdue, isStale, STALE_AFTER_DAYS } from '@/lib/dday';

describe('daysUntilDue', () => {
  it('이사일 당일이면 오프셋 그대로 남는다', () => {
    expect(daysUntilDue('2026-03-02', 14, new Date('2026-03-02T09:00:00Z'))).toBe(14);
  });

  it('기한 당일이면 0이다', () => {
    expect(daysUntilDue('2026-03-02', 14, new Date('2026-03-16T23:00:00Z'))).toBe(0);
  });

  it('기한이 지나면 음수다', () => {
    expect(daysUntilDue('2026-03-02', 14, new Date('2026-03-17T00:00:00Z'))).toBe(-1);
  });

  it('오프셋이 null이면 기한이 없으므로 null이다', () => {
    expect(daysUntilDue('2026-03-02', null, new Date('2026-03-02T00:00:00Z'))).toBeNull();
  });

  it('같은 날 안에서는 시각이 달라도 결과가 같다', () => {
    const morning = daysUntilDue('2026-03-02', 14, new Date('2026-03-10T00:00:00Z'));
    const evening = daysUntilDue('2026-03-02', 14, new Date('2026-03-10T23:59:00Z'));
    expect(morning).toBe(evening);
  });
});

describe('isOverdue', () => {
  it('남은 날이 음수면 지난 것이다', () => {
    expect(isOverdue(-1)).toBe(true);
  });

  it('당일과 미래는 지나지 않았다', () => {
    expect(isOverdue(0)).toBe(false);
    expect(isOverdue(3)).toBe(false);
  });

  it('기한이 없으면 지날 수 없다', () => {
    expect(isOverdue(null)).toBe(false);
  });
});

describe('isStale', () => {
  it('기준일수를 넘기면 오래된 정보다', () => {
    const today = new Date('2026-09-24T00:00:00Z');
    const old = new Date(today.getTime() - (STALE_AFTER_DAYS + 1) * 86400000);
    expect(isStale(old, today)).toBe(true);
  });

  it('기준일수 이내면 오래되지 않았다', () => {
    const today = new Date('2026-09-24T00:00:00Z');
    const recent = new Date(today.getTime() - 10 * 86400000);
    expect(isStale(recent, today)).toBe(false);
  });
});