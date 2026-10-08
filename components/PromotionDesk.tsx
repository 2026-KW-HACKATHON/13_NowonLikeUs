'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import PromotionEditor from '@/components/PromotionEditor';
import { readApiError } from '@/lib/authView';
import { askerContext, timeAgo } from '@/lib/questionBoard';
import { useSession } from '@/lib/useSession';
import type { PromotionQueueItem, PromotionQueueResponse } from '@/lib/types';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string; status: number | null }
  | { kind: 'ready'; items: PromotionQueueItem[] };

/** 승격 큐와 편집기. 한 번에 질문 하나만 편집한다. */
export default function PromotionDesk() {
  const session = useSession();

  if (!session.loaded) {
    return (
      <p className="empty" role="status">
        확인하는 중입니다…
      </p>
    );
  }
  if (!session.user) {
    return (
      <p className="note">
        운영자만 쓸 수 있는 화면입니다.{' '}
        <Link href={`/login?next=${encodeURIComponent('/admin/promotions')}`}>운영자 계정으로 로그인</Link>
      </p>
    );
  }
  // 토큰의 역할은 최대 7일 전 값이다. 여기서는 안내만 하고, 실제 권한은 서버 응답(403)이 정한다.
  if (session.user.role !== 'ADMIN') {
    return <p className="note">운영자만 쓸 수 있는 화면입니다. 지금 계정은 일반 회원입니다.</p>;
  }
  return <Queue />;
}

function Queue() {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<PromotionQueueItem | null>(null);
  const [published, setPublished] = useState<{ taskId: string; title: string } | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ignore = false;
    fetch('/api/admin/promotions', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const message = await readApiError(res, '승격 큐를 불러오지 못했습니다.');
          if (!ignore) setLoad({ kind: 'failed', message, status: res.status });
          return;
        }
        const body = (await res.json()) as PromotionQueueResponse;
        if (!ignore) setLoad({ kind: 'ready', items: body.items });
      })
      .catch(() => {
        if (!ignore) setLoad({ kind: 'failed', message: '연결이 끊겼습니다.', status: null });
      });
    return () => {
      ignore = true;
    };
  }, [attempt]);

  // 발행하고 큐로 돌아오면 결과 안내로 초점을 옮긴다.
  useEffect(() => {
    if (published) noticeRef.current?.focus();
  }, [published]);

  function reload() {
    setLoad({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }

  if (editing) {
    return (
      <PromotionEditor
        item={editing}
        onCancel={() => setEditing(null)}
        onPublished={(taskId, title) => {
          setEditing(null);
          setPublished({ taskId, title });
          reload();
        }}
        onStale={() => {
          setEditing(null);
          reload();
        }}
      />
    );
  }

  return (
    <>
      {published && (
        <div ref={noticeRef} tabIndex={-1} className="publish-notice" role="status">
          <p>
            &lsquo;{published.title}&rsquo;을(를) 할 일로 발행했습니다.{' '}
            <Link href={`/tasks/${published.taskId}`}>발행된 할 일 보기</Link>
          </p>
        </div>
      )}

      {load.kind === 'loading' && (
        <p className="empty" role="status">
          승격 큐를 불러오는 중입니다…
        </p>
      )}

      {load.kind === 'failed' && (
        <div role="alert">
          <p className="warn">{load.message}</p>
          {load.status !== 401 && load.status !== 403 && (
            <button type="button" className="secondary-button" onClick={reload}>
              다시 불러오기
            </button>
          )}
        </div>
      )}

      {load.kind === 'ready' && load.items.length === 0 && (
        <p className="empty">승격할 질문이 없습니다. 주민 답변이 달리면 여기에 나옵니다.</p>
      )}

      {load.kind === 'ready' && load.items.length > 0 && (
        <>
          <p className="queue-note">
            &ldquo;맞아요&rdquo;가 많은 순입니다. 확인 수는 순서일 뿐 승격 조건이 아닙니다 — 내용을 직접 확인한 뒤
            발행하세요.
          </p>
          <ol className="qlist">
            {load.items.map((item) => (
              <li key={item.question.id}>
                <QueueRow item={item} onPick={() => setEditing(item)} />
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

function QueueRow({ item, onPick }: { item: PromotionQueueItem; onPick: () => void }) {
  const q = item.question;
  const context = askerContext(q);
  const now = new Date();
  return (
    <article className="qcard" aria-label={q.text}>
      <div className="qcard__meta">
        <span className="queue-count">맞아요 {item.totalConfirmations}</span>
        <span>{timeAgo(q.createdAt, now)}</span>
        {q.askerNickname && <span>질문: {q.askerNickname}</span>}
      </div>
      <h2 className="qcard__text">{q.text}</h2>
      {context && <p className="qcard__context">{context}</p>}
      <p className="answers__label">
        주민 답변 {q.answers.length}개 <span className="answers__caveat">· 운영자 확인 전</span>
      </p>
      <ul className="answers__list">
        {q.answers.map((a) => (
          <li key={a.id} className="answer-row">
            <p className="answer-row__text">{a.text}</p>
            <p className="answer-row__by">
              {a.authorNickname} · 맞아요 {a.confirmationCount}
            </p>
          </li>
        ))}
      </ul>
      <button type="button" className="secondary-button" onClick={onPick}>
        할 일로 정리하기
      </button>
    </article>
  );
}
