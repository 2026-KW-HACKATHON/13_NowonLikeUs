import type { Task } from '@prisma/client';
import { daysUntilDue, isOverdue, isStale } from './dday';
import type { MatchedTask } from './types';

/**
 * DB의 할 일 한 줄 → 화면에 보낼 MatchedTask.
 * 목록 API와 상세 API가 같은 모양을 내보내도록 여기 한 곳에서만 만든다.
 * 이사일을 모르면 남은 날짜를 계산할 수 없으므로 daysLeft는 null.
 */
export function toMatchedTask(t: Task, moveInDate: string | null, today: Date): MatchedTask {
  const daysLeft = moveInDate ? daysUntilDue(moveInDate, t.dueOffsetDays, today) : null;
  return {
    id: t.id,
    title: t.title,
    why: t.why,
    howTo: t.howTo,
    category: t.category,
    linkUrl: t.linkUrl,
    placeName: t.placeName,
    placeAddress: t.placeAddress,
    placePhone: t.placePhone,
    daysLeft,
    overdue: isOverdue(daysLeft),
    stale: isStale(t.verifiedAt, today),
    verifiedAt: t.verifiedAt.toISOString(),
  };
}

/** 기한 임박한 순. 기한 없는 항목은 뒤로 보낸다. */
export function byDueDate(a: MatchedTask, b: MatchedTask): number {
  if (a.daysLeft === null && b.daysLeft === null) return 0;
  if (a.daysLeft === null) return 1;
  if (b.daysLeft === null) return -1;
  return a.daysLeft - b.daysLeft;
}