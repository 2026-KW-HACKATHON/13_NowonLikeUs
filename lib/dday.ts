const MS_PER_DAY = 86400000;

/** 한국은 서머타임이 없어 언제나 UTC+9 다. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 약 6개월. 이 일수를 넘긴 정보에는 "오래된 정보" 배지를 단다. */
export const STALE_AFTER_DAYS = 183;

/**
 * 그 순간이 한국에서 며칠인지를 그 날짜의 UTC 자정 숫자로 돌려준다. 날짜만 비교하기 위한 값이다.
 *
 * 서버(Vercel)는 UTC 로 돌아서 `new Date()` 를 UTC 날짜로 자르면 한국 새벽 0~9시가 "어제"가 된다.
 * 그러면 남은 날짜가 하루 많게 보인다 — 기한을 넘겨 과태료가 붙는 할 일에서 "아직 하루 남음"으로 틀린다.
 * 사용자는 모두 월계1동(한국)에 있으므로 "오늘"은 항상 한국 날짜로 센다.
 */
export function seoulDay(d: Date): number {
  const shifted = new Date(d.getTime() + KST_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

/**
 * 이사일 + 오프셋으로 기한을 구해 오늘(한국 날짜)까지 며칠 남았는지 센다.
 * 오프셋이 null이면 기한이 없는 할 일이므로 null을 돌려준다.
 * 이사일은 사용자가 고른 'YYYY-MM-DD' 그대로의 날짜다(시각이 없다).
 */
export function daysUntilDue(
  moveInDate: string,
  dueOffsetDays: number | null,
  today: Date,
): number | null {
  if (dueOffsetDays === null) return null;
  const moveIn = Date.parse(`${moveInDate}T00:00:00Z`);
  const due = moveIn + dueOffsetDays * MS_PER_DAY;
  return Math.round((due - seoulDay(today)) / MS_PER_DAY);
}

export function isOverdue(daysLeft: number | null): boolean {
  return daysLeft !== null && daysLeft < 0;
}

export function isStale(verifiedAt: Date, today: Date): boolean {
  return (seoulDay(today) - seoulDay(verifiedAt)) / MS_PER_DAY >= STALE_AFTER_DAYS;
}
