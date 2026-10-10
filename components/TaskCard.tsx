import Link from 'next/link';
import { CATEGORY_LABEL, dueLabel } from '@/lib/labels';
import type { MatchedTask } from '@/lib/types';

/**
 * 목록의 할 일 한 줄.
 *
 * 금액 · 기한 · 장소는 전부 원문 그대로 렌더한다.
 * AI 가 이 값들을 다시 쓰지 않는 것이 오정보 방어의 핵심이다.
 *
 * 카드 전체가 상세로 가는 링크다. 제목만 링크로 두면 터치 영역이 좁아진다.
 * 분류는 묶음 제목의 분류 칩이 알려 준다. 여러 분류가 섞이는 "끝낸 일"에서만 카드에 분류 이름을 붙인다.
 */
export default function TaskCard({ task, done = false }: { task: MatchedTask; done?: boolean }) {
  const due = dueLabel(task);

  return (
    <Link href={`/tasks/${task.id}`} className={`task-row${done ? ' done' : ''}`} data-category={task.category}>
      <div className="task-row__top">
        {done && <span className="task-row__cat">{CATEGORY_LABEL[task.category]}</span>}
        {done ? (
          <span className="task-row__due">✓ 완료</span>
        ) : (
          <span className={`task-row__due ${due.tone}`}>{due.text}</span>
        )}
      </div>
      <h3 className="task-row__title">{task.title}</h3>
      <p className="task-row__why">{task.why}</p>
      {task.stale && <p className="task-row__stale">오래된 정보일 수 있습니다</p>}
    </Link>
  );
}
