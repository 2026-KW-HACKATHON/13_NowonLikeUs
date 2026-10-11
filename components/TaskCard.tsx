'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CATEGORY_LABEL, dueLabel } from '@/lib/labels';
import { toggleDone } from '@/lib/progress';
import type { MatchedTask } from '@/lib/types';

/**
 * 목록의 할 일 한 장.
 *
 * 금액 · 기한 · 장소는 전부 원문 그대로 렌더한다.
 * AI 가 이 값들을 다시 쓰지 않는 것이 오정보 방어의 핵심이다.
 *
 * 왼쪽 동그라미는 완료 체크, 나머지 카드 전체는 상세로 가는 링크다. 이미 아는 일은 상세에
 * 들어가지 않고 목록에서 바로 지운다. 링크 안에 버튼을 넣으면 안 되므로 둘을 나란히 둔다.
 *
 * 분류는 묶음 제목의 분류 칩이 알려 준다. 여러 분류가 섞이는 "끝낸 일"에서만 카드에 분류 이름을 붙인다.
 * 기한이 없는 일은 "알아 두기"라 한 단계 낮춘다 — "기한 없음" 글자를 빼고 이유를 한 줄로 줄인다.
 * 전문은 상세에 그대로 있다.
 */
export default function TaskCard({ task, done = false }: { task: MatchedTask; done?: boolean }) {
  const due = dueLabel(task);
  const quiet = !done && task.daysLeft === null;
  // 저장이 막힌 환경(시크릿 창 등)에서는 눌러도 안 바뀐다. 말없이 넘어가면 고장난 줄 안다.
  const [saveFailed, setSaveFailed] = useState(false);

  const className = ['task-row', done && 'done', quiet && 'task-row--quiet'].filter(Boolean).join(' ');

  return (
    <div className={className} data-category={task.category}>
      <button
        type="button"
        className="task-row__check"
        aria-pressed={done}
        aria-label={done ? `${task.title} 완료 취소` : `${task.title} 완료로 표시`}
        onClick={() => setSaveFailed(!toggleDone(task.id))}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 12.5l4 4 8-9" />
        </svg>
      </button>
      <Link href={`/tasks/${task.id}`} className="task-row__link">
        {(done || due.tone !== 'none') && (
          <div className="task-row__top">
            {done && <span className="task-row__cat">{CATEGORY_LABEL[task.category]}</span>}
            {done ? (
              <span className="task-row__due none">✓ 완료</span>
            ) : (
              <span className={`task-row__due ${due.tone}`}>{due.text}</span>
            )}
          </div>
        )}
        <h3 className="task-row__title">{task.title}</h3>
        <p className="task-row__why">{task.why}</p>
        {task.stale && <p className="task-row__stale">오래된 정보일 수 있습니다</p>}
      </Link>
      {saveFailed && (
        <p className="task-row__error" role="alert">
          이 브라우저에서는 저장할 수 없습니다. 시크릿 창이거나 사이트 데이터가 차단된 상태일 수 있습니다.
        </p>
      )}
    </div>
  );
}
