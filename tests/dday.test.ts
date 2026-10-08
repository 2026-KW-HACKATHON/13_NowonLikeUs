import { describe, it, expect } from 'vitest';
import { daysUntilDue, isOverdue, isStale, seoulDay, STALE_AFTER_DAYS } from '@/lib/dday';

// 시각은 모두 UTC(Z)로 적고, 주석에 한국 시각(KST = UTC+9)을 같이 적는다.

describe('daysUntilDue', () => {
  it('이사일 당일이면 오프셋 그대로 남는다', () => {
    // KST 3/2 18:00
    expect(daysUntilDue('2026-03-02', 14, new Date('2026-03-02T09:00:00Z'))).toBe(14);
  });

  it('기한 당일이면 0이다', () => {
    // KST 3/16 23:00
    expect(daysUntilDue('2026-03-02', 14, new Date('2026-03-16T14:00:00Z'))).toBe(0);
  });

  it('기한이 지나면 음수다', () => {
    // KST 3/17 09:00
    expect(daysUntilDue('2026-03-02', 14, new Date('2026-03-17T00:00:00Z'))).toBe(-1);
  });

  it('오프셋이 null이면 기한이 없으므로 null이다', () => {
    expect(daysUntilDue('2026-03-02', null, new Date('2026-03-02T00:00:00Z'))).toBeNull();
  });

  it('한국 날짜로 같은 날 안에서는 시각이 달라도 결과가 같다', () => {
    const midnight = daysUntilDue('2026-03-02', 14, new Date('2026-03-09T15:00:00Z')); // KST 3/10 00:00
    const lateNight = daysUntilDue('2026-03-02', 14, new Date('2026-03-10T14:59:00Z')); // KST 3/10 23:59
    expect(midnight).toBe(6);
    expect(lateNight).toBe(6);
  });

  describe('서버가 UTC 로 돌아도 한국 새벽(0~9시)을 어제로 세지 않는다', () => {
    // 이사 10/1, 기한 14일 → 마감 10/15
    it('KST 마감일 새벽 08:00 → 0 (오늘까지)', () => {
      expect(daysUntilDue('2026-10-01', 14, new Date('2026-10-14T23:00:00Z'))).toBe(0);
    });

    it('KST 마감 다음날 새벽 08:00 → -1 (지남)', () => {
      expect(daysUntilDue('2026-10-01', 14, new Date('2026-10-15T23:00:00Z'))).toBe(-1);
    });

    it('KST 자정 직후 00:00 → 그날로 센다', () => {
      expect(daysUntilDue('2026-10-01', 14, new Date('2026-10-14T15:00:00Z'))).toBe(0);
    });

    it('KST 자정 직전 23:59 → 아직 전날이다', () => {
      expect(daysUntilDue('2026-10-01', 14, new Date('2026-10-14T14:59:00Z'))).toBe(1);
    });
  });
});

describe('seoulDay', () => {
  it('UTC 로는 전날이어도 한국 날짜를 돌려준다', () => {
    // UTC 10/7 20:00 = KST 10/8 05:00
    expect(seoulDay(new Date('2026-10-07T20:00:00Z'))).toBe(Date.UTC(2026, 9, 8));
  });

  it('한국 오후는 UTC 와 날짜가 같다', () => {
    // UTC 10/8 06:00 = KST 10/8 15:00
    expect(seoulDay(new Date('2026-10-08T06:00:00Z'))).toBe(Date.UTC(2026, 9, 8));
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