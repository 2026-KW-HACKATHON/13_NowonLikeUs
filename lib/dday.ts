const MS_PER_DAY = 86400000;

/** 약 6개월. 이 일수를 넘긴 정보에는 "오래된 정보" 배지를 단다. */
export const STALE_AFTER_DAYS = 183;

/** 자정 기준으로 잘라 날짜만 비교한다. 같은 날 안에서는 시각이 결과를 바꾸지 않는다. */
function toUtcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * 이사일 + 오프셋으로 기한을 구해 오늘까지 며칠 남았는지 센다.
 * 오프셋이 null이면 기한이 없는 할 일이므로 null을 돌려준다.
 */
export function daysUntilDue(
  moveInDate: string,
  dueOffsetDays: number | null,
  today: Date,
): number | null {
  if (dueOffsetDays === null) return null;
  const moveIn = toUtcMidnight(new Date(`${moveInDate}T00:00:00Z`));
  const due = moveIn + dueOffsetDays * MS_PER_DAY;
  return Math.round((due - toUtcMidnight(today)) / MS_PER_DAY);
}

export function isOverdue(daysLeft: number | null): boolean {
  return daysLeft !== null && daysLeft < 0;
}

export function isStale(verifiedAt: Date, today: Date): boolean {
  return (toUtcMidnight(today) - toUtcMidnight(verifiedAt)) / MS_PER_DAY >= STALE_AFTER_DAYS;
}