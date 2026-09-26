import type { MatchedTask } from '@/lib/types';

function dueLabel(task: MatchedTask): { text: string; tone: string } {
  if (task.daysLeft === null) return { text: '기한 없음', tone: 'none' };
  if (task.daysLeft < 0) return { text: `기한 ${Math.abs(task.daysLeft)}일 지남`, tone: 'overdue' };
  if (task.daysLeft === 0) return { text: '오늘까지', tone: 'overdue' };
  return { text: `${task.daysLeft}일 남음`, tone: '' };
}

function asOfLabel(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 기준`;
}

/**
 * 금액·기한·장소는 전부 원문 그대로 렌더한다.
 * AI 가 이 값들을 다시 쓰지 않는 것이 오정보 방어의 핵심이다.
 */
export default function TaskCard({ task }: { task: MatchedTask }) {
  const due = dueLabel(task);

  return (
    <article className={`card${task.overdue ? ' overdue' : ''}`}>
      <span className={`badge ${due.tone}`}>{due.text}</span>
      <h3>{task.title}</h3>
      <p className="why">{task.why}</p>
      <p className="asof">
        {asOfLabel(task.verifiedAt)}
        {task.stale ? ' · 오래된 정보일 수 있습니다' : ''}
      </p>
    </article>
  );
}
