'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ANSWER_MAX, validateAnswer } from '@/lib/answerValidation';
import { readApiError } from '@/lib/authView';
import { canDeleteQuestion } from '@/lib/moderation';
import {
  QUESTION_TABS,
  answerSlot,
  askerContext,
  confirmSlot,
  isModerator,
  timeAgo,
  withAnswer,
  withAnswerHidden,
  withAnswerRestored,
  withConfirm,
  withoutQuestion,
} from '@/lib/questionBoard';
import { loadSession, useSession } from '@/lib/useSession';
import type {
  AnswerItem,
  ConfirmAnswerResponse,
  CreateAnswerRequest,
  CreateAnswerResponse,
  DeleteQuestionResponse,
  HideAnswerRequest,
  HideAnswerResponse,
  QuestionItem,
  QuestionListResponse,
  QuestionStatus,
} from '@/lib/types';

type Load = { kind: 'loading' } | { kind: 'failed'; message: string } | { kind: 'ready'; questions: QuestionItem[] };

/**
 * 질문 목록. 탭이 바뀌면 부모가 `key` 로 새로 만들어서, 불러오는 중 상태부터 다시 시작한다.
 *
 * 주민 답변은 운영자가 확인하기 전 정보다. 화면 어디서도 확인된 정보처럼 보이게 하지 않는다.
 *
 * 운영자(ADMIN)에게만 정리 버튼이 보인다 — 질문 지우기(되돌릴 수 없어 한 번 더 묻는다) · 답변 숨기기(되돌릴 수 있다).
 * 질문은 로그인 없이 올라와 표지에도 뜨므로, 장난 · 욕설 · 개인정보를 시연 중에도 화면에서 바로 내리기 위한 것이다.
 */
export default function QuestionBoard({ status }: { status: QuestionStatus }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // 질문을 지우면 그 카드가 사라져 결과를 알릴 자리가 없다. 목록 위에서 알린다.
  const [notice, setNotice] = useState<string | null>(null);
  const tab = QUESTION_TABS.find((t) => t.status === status)!;

  useEffect(() => {
    let ignore = false;
    fetch(`/api/questions?status=${status}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readApiError(res, '질문을 불러오지 못했습니다.'));
        return (await res.json()) as QuestionListResponse;
      })
      .then((body) => {
        if (!ignore) setLoad({ kind: 'ready', questions: body.questions });
      })
      .catch((e: unknown) => {
        if (ignore) return;
        const message = e instanceof Error && e.message !== 'Failed to fetch' ? e.message : '연결이 끊겼습니다.';
        setLoad({ kind: 'failed', message });
      });
    return () => {
      ignore = true;
    };
  }, [status, attempt]);

  // 목록은 화면이 나중에 불러온다. 브라우저의 #q-... 이동은 그 전에 끝나므로, 다 불러온 뒤 직접 옮긴다.
  // 질문 화면의 "이웃의 질문에서 보기", 로그인 후 복귀가 이 주소로 온다. 한 번만 옮긴다.
  // 브라우저의 :target 도 그 시점에 없던 요소에는 걸리지 않아서, 찾아온 질문 표시도 직접 한다.
  const [targetId] = useState(() =>
    typeof window !== 'undefined' && location.hash.startsWith('#q-') ? location.hash.slice(3) : null,
  );
  const scrolled = useRef(false);
  useEffect(() => {
    if (load.kind !== 'ready' || scrolled.current || !targetId) return;
    scrolled.current = true;
    const target = document.getElementById(`q-${targetId}`);
    if (!target) return;
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  }, [load, targetId]);

  function update(fn: (questions: QuestionItem[]) => QuestionItem[]) {
    setLoad((prev) => (prev.kind === 'ready' ? { kind: 'ready', questions: fn(prev.questions) } : prev));
  }

  if (load.kind === 'loading') {
    return (
      <p className="empty" role="status">
        질문을 불러오는 중입니다…
      </p>
    );
  }

  if (load.kind === 'failed') {
    return (
      <div role="alert">
        <p className="warn">{load.message} 잠시 후 다시 시도해 주세요.</p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setLoad({ kind: 'loading' });
            setAttempt((n) => n + 1);
          }}
        >
          다시 불러오기
        </button>
      </div>
    );
  }

  const noticeLine = notice && (
    <p className="qboard__notice" role="status">
      {notice}
    </p>
  );

  if (load.questions.length === 0) {
    return (
      <>
        {noticeLine}
        <p className="empty">{tab.empty}</p>
      </>
    );
  }

  return (
    <>
      {noticeLine}
      <ol className="qlist">
        {load.questions.map((q) => (
          <li key={q.id}>
            <QuestionCard
              question={q}
              isTarget={q.id === targetId}
              onAnswered={(answer) => update((list) => withAnswer(list, q.id, answer))}
              onConfirmed={(answerId, res) => update((list) => withConfirm(list, answerId, res))}
              onDeleted={() => {
                update((list) => withoutQuestion(list, q.id));
                setNotice('질문을 지웠습니다. 표지와 이 목록에서 더 보이지 않습니다.');
              }}
              onHidden={(answerId, status) => update((list) => withAnswerHidden(list, answerId, status))}
              onRestored={(answer, status) => update((list) => withAnswerRestored(list, answer, status))}
            />
          </li>
        ))}
      </ol>
    </>
  );
}

function QuestionCard({
  question: q,
  isTarget,
  onAnswered,
  onConfirmed,
  onDeleted,
  onHidden,
  onRestored,
}: {
  question: QuestionItem;
  isTarget: boolean;
  onAnswered: (answer: AnswerItem) => void;
  onConfirmed: (answerId: string, res: ConfirmAnswerResponse) => void;
  onDeleted: () => void;
  onHidden: (answerId: string, status: QuestionStatus) => void;
  onRestored: (answer: AnswerItem, status: QuestionStatus) => void;
}) {
  const session = useSession();
  const moderator = isModerator(session.user);
  // 방금 숨긴 답변. 목록에서는 빠지지만 되돌릴 수 있게 이 카드가 들고 있는다(새로고침하면 사라진다).
  const [hidden, setHidden] = useState<AnswerItem[]>([]);
  const context = askerContext(q);
  const headingId = useId();
  const now = new Date();
  const slot = answerSlot(q.status, { loaded: session.loaded, loggedIn: session.user !== null });

  return (
    // tabIndex -1: 주소의 #q-... 로 왔을 때 스크린리더 초점을 이 질문으로 옮길 수 있게.
    <article className={isTarget ? 'qcard qcard--target' : 'qcard'} id={`q-${q.id}`} aria-labelledby={headingId} tabIndex={-1}>
      {/*
        AI 신뢰도 배지는 붙이지 않는다. "아직 아무도 확인하지 않았습니다"는 AI 답변용 문구라,
        바로 아래 주민 답변이 달려 있으면 말이 어긋난다. 이 목록에는 GROUNDED 가 애초에 없다.
      */}
      <div className="qcard__meta">
        {q.status === 'PROMOTED' && <span className="qcard__state qcard__state--promoted">할 일로 정리됨</span>}
        <span>{timeAgo(q.createdAt, now)}</span>
      </div>
      <h2 id={headingId} className="qcard__text">
        {q.text}
      </h2>
      {context && <p className="qcard__context">{context}</p>}

      {q.answers.length > 0 && (
        <section className="answers" aria-label={`주민 답변 ${q.answers.length}개`}>
          <p className="answers__label">
            주민 답변 {q.answers.length}개 <span className="answers__caveat">· 운영자 확인 전</span>
          </p>
          <ul className="answers__list">
            {q.answers.map((a) => (
              <AnswerRow
                key={a.id}
                answer={a}
                now={now}
                canConfirm={confirmSlot(a, { loggedIn: session.user !== null, status: q.status }) === 'button'}
                onConfirmed={onConfirmed}
                onHide={
                  moderator
                    ? (status) => {
                        setHidden((list) => [...list, a]);
                        onHidden(a.id, status);
                      }
                    : undefined
                }
              />
            ))}
          </ul>
        </section>
      )}

      {moderator && hidden.length > 0 && (
        <ul className="answers__list answers__list--hidden" aria-label="숨긴 답변">
          {hidden.map((a) => (
            <HiddenAnswerRow
              key={a.id}
              answer={a}
              onRestored={(status) => {
                setHidden((list) => list.filter((h) => h.id !== a.id));
                onRestored(a, status);
              }}
            />
          ))}
        </ul>
      )}

      {slot === 'closed' && <p className="qcard__closed">이 질문은 확인을 거쳐 할 일 목록에 올라갔습니다.</p>}
      {slot === 'login' && (
        <Link className="qcard__login" href={`/login?next=${encodeURIComponent(`/questions?status=${q.status}#q-${q.id}`)}`}>
          로그인하고 답하기
        </Link>
      )}
      {slot === 'form' && <AnswerForm questionId={q.id} onAnswered={onAnswered} />}
      {moderator && canDeleteQuestion(q.status) && <DeleteQuestion questionId={q.id} onDeleted={onDeleted} />}
    </article>
  );
}

function AnswerRow({
  answer: a,
  now,
  canConfirm,
  onConfirmed,
  onHide,
}: {
  answer: AnswerItem;
  now: Date;
  canConfirm: boolean;
  onConfirmed: (answerId: string, res: ConfirmAnswerResponse) => void;
  /** 운영자에게만 넘어온다. 숨기기에 성공하면 서버가 다시 맞춘 질문 상태와 함께 부른다. */
  onHide?: (questionStatus: QuestionStatus) => void;
}) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function confirm() {
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/answers/${a.id}/confirm`, { method: 'POST' });
      if (res.status === 401) await loadSession(true);
      if (!res.ok) {
        setMessage(await readApiError(res, '지금은 누를 수 없습니다. 잠시 후 다시 시도해 주세요.'));
        return;
      }
      onConfirmed(a.id, (await res.json()) as ConfirmAnswerResponse);
    } catch {
      setMessage('연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSending(false);
    }
  }

  return (
    <li className="answer-row">
      <p className="answer-row__text">{a.text}</p>
      <div className="answer-row__foot">
        <span className="answer-row__by">
          {a.authoredByMe && <span className="answer-row__mine">내 답변 · </span>}
          {a.authorNickname} · {timeAgo(a.createdAt, now)}
        </span>
        {canConfirm ? (
          <button
            type="button"
            className="confirm"
            aria-pressed={a.confirmedByMe}
            onClick={confirm}
            // 이미 눌렀으면 다시 누를 일이 없다. 취소 기능은 없다(서버 범위 밖).
            disabled={sending || a.confirmedByMe}
          >
            <span aria-hidden="true">{a.confirmedByMe ? '✓' : '+'}</span> 맞아요 {a.confirmationCount}
          </button>
        ) : (
          <span className="confirm confirm--static">맞아요 {a.confirmationCount}</span>
        )}
        {onHide && (
          <button
            type="button"
            className="mod-button"
            onClick={async () => {
              setSending(true);
              setMessage(null);
              const result = await setAnswerHidden(a.id, true);
              setSending(false);
              if (typeof result === 'string') setMessage(result);
              else onHide(result.questionStatus);
            }}
            disabled={sending}
          >
            답변 숨기기
          </button>
        )}
      </div>
      {message && (
        <p className="field-error" role="status">
          {message}
        </p>
      )}
    </li>
  );
}

function AnswerForm({ questionId, onAnswered }: { questionId: string; onAnswered: (answer: AnswerItem) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <>
        {sent && (
          <p className="qcard__sent" role="status">
            답변을 남겼습니다. 운영자가 확인하면 다음 사람의 할 일이 될 수 있습니다.
          </p>
        )}
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setSent(false);
            setOpen(true);
          }}
        >
          {sent ? '답변 하나 더 쓰기' : '답변 쓰기'}
        </button>
      </>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const checked = validateAnswer({ text });
    if (!checked.ok) {
      setError(checked.error);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setSending(true);
    try {
      const body: CreateAnswerRequest = { text: checked.value.text };
      const res = await fetch(`/api/questions/${questionId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) await loadSession(true);
      if (!res.ok) {
        setError(await readApiError(res, '답변을 남기지 못했습니다. 잠시 후 다시 시도해 주세요.'));
        return;
      }
      onAnswered(((await res.json()) as CreateAnswerResponse).answer);
      setText('');
      setSent(true);
      setOpen(false);
    } catch {
      setError('연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form id={id} className="answer-form" onSubmit={handleSubmit} noValidate>
      <label className="ask-label" htmlFor={`${id}-text`}>
        내 답변
      </label>
      <textarea
        ref={inputRef}
        id={`${id}-text`}
        className="ask-input answer-form__input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={ANSWER_MAX}
        rows={4}
        aria-describedby={`${id}-count ${id}-notice`}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error ? `${id}-error` : undefined}
        disabled={sending}
      />
      <div className="ask-meta">
        {error ? (
          <p id={`${id}-error`} className="field-error" role="alert">
            {error}
          </p>
        ) : (
          <span />
        )}
        <p id={`${id}-count`} className="ask-count">
          {text.length} / {ANSWER_MAX}자
        </p>
      </div>
      <p id={`${id}-notice`} className="ask-notice">
        답변은 닉네임과 함께 누구나 볼 수 있습니다. 직접 겪거나 확인한 것만 적어 주세요. 이름 · 연락처 · 상세 주소는 적지 마세요.
      </p>
      <div className="answer-form__actions">
        <button type="submit" disabled={sending}>
          {sending ? '남기는 중…' : '답변 남기기'}
        </button>
        <button type="button" className="secondary-button" onClick={() => setOpen(false)} disabled={sending}>
          취소
        </button>
      </div>
    </form>
  );
}

/** 운영자 요청 공통. 401 · 403 이면 세션을 다시 읽어 버튼을 거둔다. 실패하면 화면에 띄울 문장을 돌려준다. */
async function moderate<T>(request: () => Promise<Response>, fallback: string): Promise<T | string> {
  try {
    const res = await request();
    if (res.status === 401 || res.status === 403) await loadSession(true);
    if (!res.ok) return await readApiError(res, fallback);
    return (await res.json()) as T;
  } catch {
    return '연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.';
  }
}

function setAnswerHidden(answerId: string, isHidden: boolean): Promise<HideAnswerResponse | string> {
  const body: HideAnswerRequest = { isHidden };
  return moderate<HideAnswerResponse>(
    () =>
      fetch(`/api/admin/answers/${answerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    isHidden ? '답변을 숨기지 못했습니다.' : '답변을 되돌리지 못했습니다.',
  );
}

/** 운영자가 방금 숨긴 답변 자리. 다른 사람에게는 이미 안 보인다. */
function HiddenAnswerRow({ answer: a, onRestored }: { answer: AnswerItem; onRestored: (status: QuestionStatus) => void }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <li className="answer-row answer-row--hidden">
      <p className="answer-row__hidden" role="status">
        {a.authorNickname} 님의 답변을 숨겼습니다. 다른 사람에게는 보이지 않습니다.
      </p>
      <button
        type="button"
        className="mod-button"
        onClick={async () => {
          setSending(true);
          setMessage(null);
          const result = await setAnswerHidden(a.id, false);
          setSending(false);
          if (typeof result === 'string') setMessage(result);
          else onRestored(result.questionStatus);
        }}
        disabled={sending}
      >
        되돌리기
      </button>
      {message && (
        <p className="field-error" role="status">
          {message}
        </p>
      )}
    </li>
  );
}

/**
 * 질문 지우기. 답변 · 맞아요까지 같이 지워지고 되돌릴 수 없어서, 브라우저 확인 창 대신 같은 자리에서 한 번 더 묻는다.
 * 할 일로 정리된 질문에는 이 버튼을 띄우지 않는다(서버도 409).
 */
function DeleteQuestion({ questionId, onDeleted }: { questionId: string; onDeleted: () => void }) {
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (asking) confirmRef.current?.focus();
  }, [asking]);

  if (!asking) {
    return (
      <div className="qcard__mod">
        <button type="button" className="mod-button" onClick={() => setAsking(true)}>
          질문 지우기 (운영자)
        </button>
      </div>
    );
  }

  return (
    <div className="qcard__mod qcard__mod--confirm" role="group" aria-label="질문 지우기 확인">
      <p className="qcard__mod-ask">이 질문을 지울까요? 달린 답변과 맞아요도 같이 지워지고, 되돌릴 수 없습니다.</p>
      <div className="qcard__mod-actions">
        <button
          ref={confirmRef}
          type="button"
          className="mod-button mod-button--danger"
          onClick={async () => {
            setSending(true);
            setMessage(null);
            const result = await moderate<DeleteQuestionResponse>(
              () => fetch(`/api/admin/questions/${questionId}`, { method: 'DELETE' }),
              '질문을 지우지 못했습니다.',
            );
            setSending(false);
            if (typeof result === 'string') setMessage(result);
            else onDeleted();
          }}
          disabled={sending}
        >
          {sending ? '지우는 중…' : '지우기'}
        </button>
        <button type="button" className="mod-button" onClick={() => setAsking(false)} disabled={sending}>
          취소
        </button>
      </div>
      {message && (
        <p className="field-error" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
