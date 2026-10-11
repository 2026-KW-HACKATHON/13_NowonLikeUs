'use client';

import { useEffect, useState } from 'react';
import CategoryIcon from '@/components/CategoryIcon';
import { CATEGORY_LABEL } from '@/lib/labels';
import { findOverlaps } from '@/lib/promotionOverlap';
import type { AdminTaskListResponse, AdminTaskSummary, TaskConditions } from '@/lib/types';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; tasks: AdminTaskSummary[] };

/**
 * 승격 양식의 "이 사람들에게 이미 보이는 할 일". 노출 조건을 바꾸면 바로 다시 계산한다.
 *
 * 새 할 일이 기존 할 일과 서로 모르는 문장으로 나란히 뜨지 않게, 운영자가 겹치는 할 일을 보고 쓰게 한다.
 * 보여 주기만 하고 아무것도 숨기거나 고치지 않는다. 불러오지 못해도 발행은 막지 않는다.
 */
export default function TaskOverlapPanel({ conditions }: { conditions: TaskConditions }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  useEffect(() => {
    let ignore = false;
    fetch('/api/admin/tasks', { cache: 'no-store' })
      .then(async (res) => (res.ok ? ((await res.json()) as AdminTaskListResponse).tasks : null))
      .catch(() => null)
      .then((tasks) => {
        if (!ignore) setLoad(tasks ? { kind: 'ready', tasks } : { kind: 'failed' });
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (load.kind === 'loading') {
    return (
      <p className="editor__hint" role="status">
        이미 있는 할 일을 불러오는 중입니다…
      </p>
    );
  }

  if (load.kind === 'failed') {
    return <p className="editor__hint">이미 있는 할 일을 불러오지 못해 겹치는 할 일 확인을 건너뜁니다. 발행은 그대로 할 수 있습니다.</p>;
  }

  const { related, general } = findOverlaps(conditions, load.tasks);

  return (
    <div className="overlap">
      <p className="editor__sublabel">이 사람들에게 이미 보이는 할 일</p>
      {related.length > 0 ? (
        <>
          <p className="editor__hint">
            아래 할 일과 함께 보입니다. 말이 엇갈리지 않게 써 주세요 — 겹치는 할 일을 같이 안내하거나, 새로 올리기보다
            기존 할 일을 고치는 게 맞을 수도 있습니다.
          </p>
          <ul className="overlap__list">
            {related.map(({ task, shared }) => (
              <li key={task.id} className="overlap__item">
                <span className="cat-chip" data-category={task.category}>
                  <CategoryIcon category={task.category} />
                  {CATEGORY_LABEL[task.category]}
                </span>
                <span className="overlap__title">{task.title}</span>
                <span className="overlap__shared">겹치는 조건: {shared.join(' · ')}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="editor__hint">같은 조건으로 좁혀 둔 할 일은 없습니다.</p>
      )}
      {general.length > 0 && (
        <details className="overlap__more">
          <summary>넓게 보이는 할 일 {general.length}건도 함께 보입니다</summary>
          <ul className="overlap__plain">
            {general.map((task) => (
              <li key={task.id}>
                {task.title} <span className="overlap__cat">· {CATEGORY_LABEL[task.category]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
