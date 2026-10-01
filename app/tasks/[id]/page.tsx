'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CATEGORY_LABEL, asOfLabel, dueLabel } from '@/lib/labels';
import { loadProfile } from '@/lib/profile';
import type { MatchedTask, TaskDetailResponse } from '@/lib/types';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; task: MatchedTask }
  | { kind: 'notfound' }
  | { kind: 'failed' };

/** 02-123-4567 같은 표기를 tel: 링크에 넣을 수 있는 형태로. 표시 문구는 원문을 쓴다. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, '')}`;
}

/**
 * 할 일 상세.
 *
 * 화면에 찍히는 금액 · 기한 · 장소 · 연락처는 전부 DB 원문이다.
 * 이 화면에는 AI 가 생성한 문장이 한 줄도 없다 — 오정보 방어 3층이 성립하는 자리다.
 */
export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    if (!id) return;

    // 이사일이 있으면 남은 날짜까지 계산해 준다. 프로필이 없어도 상세는 보여야 한다.
    const moveInDate = loadProfile()?.moveInDate;
    const query = moveInDate ? `?moveInDate=${encodeURIComponent(moveInDate)}` : '';

    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/tasks/${encodeURIComponent(id)}${query}`);
        if (!alive) return;
        if (res.status === 404) {
          setState({ kind: 'notfound' });
          return;
        }
        if (!res.ok) {
          setState({ kind: 'failed' });
          return;
        }
        const data = (await res.json()) as TaskDetailResponse;
        if (alive) setState({ kind: 'ready', task: data.task });
      } catch {
        if (alive) setState({ kind: 'failed' });
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  // Neon 무료 티어는 5분간 요청이 없으면 컴퓨트를 정지시킨다.
  // 첫 조회가 1~3초 걸릴 수 있어 멈춘 것처럼 보이지 않게 한다.
  if (state.kind === 'loading') {
    return (
      <main>
        <p className="empty" role="status">
          불러오는 중입니다…
        </p>
      </main>
    );
  }

  if (state.kind === 'notfound' || state.kind === 'failed') {
    return (
      <main>
        <Link href="/tasks" className="back">
          ← 내 할 일
        </Link>
        <h1 className="page-title">
          {state.kind === 'notfound' ? '없는 항목입니다' : '불러오지 못했습니다'}
        </h1>
        <p className="lead">
          {state.kind === 'notfound'
            ? '링크가 바뀌었거나 내려간 항목일 수 있습니다.'
            : '잠시 후 다시 시도해 주세요.'}
        </p>
      </main>
    );
  }

  const { task } = state;
  const due = dueLabel(task);

  return (
    <main>
      <Link href="/tasks" className="back">
        ← 내 할 일
      </Link>

      <div className="detail-head" data-category={task.category}>
        <div className="detail-head__top">
          <span className="detail-head__cat">{CATEGORY_LABEL[task.category]}</span>
          <span className={`detail-head__due ${due.tone}`}>{due.text}</span>
        </div>
        <h1>{task.title}</h1>
      </div>

      {task.overdue && <p className="warn">기한이 지났습니다. 과태료가 붙을 수 있습니다.</p>}
      {task.stale && (
        <p className="warn">
          마지막 확인이 6개월 넘었습니다. 전화로 한 번 더 확인하는 편이 안전합니다.
        </p>
      )}

      <section className="detail-section">
        <h2>안 하면 어떻게 되나</h2>
        <p className="detail-body">{task.why}</p>
      </section>

      <section className="detail-section">
        <h2>어떻게 하나</h2>
        <p className="detail-body">{task.howTo}</p>
      </section>

      {task.placeName && (
        <section className="detail-section">
          <h2>어디서</h2>
          <dl className="place">
            <div>
              <dt>기관</dt>
              <dd>{task.placeName}</dd>
            </div>
            {task.placeAddress && (
              <div>
                <dt>주소</dt>
                <dd>{task.placeAddress}</dd>
              </div>
            )}
            {task.placePhone && (
              <div>
                <dt>전화</dt>
                <dd>
                  <a className="tel" href={telHref(task.placePhone)}>
                    {task.placePhone}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {task.linkUrl && (
        <section className="detail-section">
          <h2>온라인으로</h2>
          <a className="button-link" href={task.linkUrl} target="_blank" rel="noopener noreferrer">
            신청 페이지 열기
            <span className="sr-only"> (새 창에서 열림)</span>
          </a>
        </section>
      )}

      <p className="asof">{asOfLabel(task.verifiedAt)} · 출처를 확인한 날짜입니다</p>
    </main>
  );
}
