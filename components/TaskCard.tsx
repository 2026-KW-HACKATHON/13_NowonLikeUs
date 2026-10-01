import Link from 'next/link';
import { CATEGORY_LABEL, asOfLabel, dueLabel } from '@/lib/labels';
import type { MatchedTask } from '@/lib/types';

/**
 * 금액 · 기한 · 장소는 전부 원문 그대로 렌더한다.
 * AI 가 이 값들을 다시 쓰지 않는 것이 오정보 방어의 핵심이다.
 *
 * 카드 전체가 상세 화면으로 가는 링크다. 제목만 링크로 두면 터치 영역이 좁아진다.
 */
export default function TaskCard({ task }: { task: MatchedTask }) {
  const due = dueLabel(task);

  return (
    <Link href={`/tasks/${task.id}`} className={`card${task.overdue ? ' overdue' : ''}`}>
      <div className="card-meta">
        <span className={`badge ${due.tone}`}>{due.text}</span>
        <span className="badge category">{CATEGORY_LABEL[task.category]}</span>
      </div>
      <h3>{task.title}</h3>
      <p className="why">{task.why}</p>
      <p className="asof">
        {asOfLabel(task.verifiedAt)}
        {task.stale ? ' · 오래된 정보일 수 있습니다' : ''}
      </p>
    </Link>
  );
}
