'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import Masthead from '@/components/Masthead';
import TaskCard from '@/components/TaskCard';
import { ASK_MAX_LENGTH, askProfile, describeAnswer } from '@/lib/askView';
import { useProfile } from '@/lib/useProfile';
import type { AskRequest, AskResponse } from '@/lib/types';

type Phase =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; res: AskResponse }
  | { kind: 'failed'; message: string };

/** 서버가 오류 문장을 주면 그대로, 못 주면 일반 문장으로. 오류 본문은 `{ error: string }` 이다. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
      return body.error;
    }
  } catch {
    // 본문이 JSON 이 아니면 아래 일반 문장을 쓴다.
  }
  return '질문을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

/**
 * 질문하기.
 *
 * AI 는 근거 카드만 고르고 문장은 쓰지 않는다. 금액 · 기한 · 장소는 아래 원문 카드에서만 나온다.
 * AI 가 꺼져 있거나 실패하면 키워드로 찾은 카드만 보여준다 (설계안 3.5 — AI 는 필수 경로가 아니다).
 *
 * `sendsToGoogle` 은 서버가 요청 시점에 읽은 실제 전송 여부다 (`app/ask/page.tsx`). 고지 문구와
 * 대기 안내가 이 값으로 갈린다.
 */
export default function AskScreen({ sendsToGoogle }: { sendsToGoogle: boolean }) {
  const { hydrated, profile } = useProfile();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  // 결과가 나오면 결과 제목으로 초점을 옮긴다. 스크린리더 사용자가 답이 나온 걸 바로 알 수 있다.
  useEffect(() => {
    if (phase.kind === 'done' || phase.kind === 'failed') resultHeading.current?.focus();
  }, [phase]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const question = text.trim();
    if (!question) {
      setFieldError('질문을 입력해 주세요.');
      return;
    }
    setFieldError(null);
    setPhase({ kind: 'sending' });

    const body: AskRequest = { text: question, profile: profile ? askProfile(profile) : undefined };
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setPhase({ kind: 'failed', message: await errorMessage(res) });
        return;
      }
      setPhase({ kind: 'done', res: (await res.json()) as AskResponse });
    } catch {
      setPhase({ kind: 'failed', message: '연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.' });
    }
  }

  const sending = phase.kind === 'sending';

  return (
    <main>
      <Masthead profile={profile} />

      <Link href="/tasks" className="back">
        ← 내 할 일
      </Link>

      <h1 className="page-title">무엇이 궁금한가요?</h1>
      <p className="lead">월계1동에서 확인된 정보로만 답합니다. 모르는 건 모른다고 답합니다.</p>

      <form className="ask-form" onSubmit={handleSubmit} noValidate>
        <label className="ask-label" htmlFor="ask-text">
          질문
        </label>
        <textarea
          id="ask-text"
          className="ask-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={ASK_MAX_LENGTH}
          rows={4}
          placeholder="예: 음식물쓰레기는 어떻게 버려요?"
          aria-describedby="ask-count ask-notice"
          aria-invalid={fieldError ? true : undefined}
          aria-errormessage={fieldError ? 'ask-error' : undefined}
          disabled={sending}
        />
        <div className="ask-meta">
          {fieldError ? (
            <p id="ask-error" className="field-error" role="alert">
              {fieldError}
            </p>
          ) : (
            <span />
          )}
          <p id="ask-count" className="ask-count">
            {text.length} / {ASK_MAX_LENGTH}자
          </p>
        </div>

        {/* 제출 버튼 바로 위 — 누르기 직전에 읽히는 자리여야 고지가 고지 노릇을 한다. */}
        <p id="ask-notice" className="ask-notice">
          {sendsToGoogle && (
            <>
              질문 내용과 주거형태 · 계약형태는 관련 항목을 찾기 위해 Google(Gemini)로 전송됩니다.{' '}
            </>
          )}
          확인된 정보로 답하지 못한 질문은 주거형태 · 계약형태와 함께 &lsquo;이웃의 질문&rsquo;에 공개되어
          주민이 답할 수 있습니다. 이름 · 연락처 · 상세 주소 같은 개인정보는 적지 마세요.
        </p>

        <button type="submit" disabled={sending}>
          {sending ? '답을 찾는 중…' : '질문하기'}
        </button>
      </form>

      {hydrated && !profile && (
        <p className="note">
          상황을 입력하면 기한까지 계산해 드립니다. <Link href="/setup">상황 입력하기</Link>
        </p>
      )}

      <section className="ask-result" aria-live="polite">
        {sending && (
          <p className="empty" role="status">
            {/* AI 가 고르는 데 10초 넘게 걸리기도 한다. 멈춘 줄 알고 다시 누르지 않게 미리 말한다. */}
            {sendsToGoogle ? '관련 항목을 찾는 중입니다… 10초쯤 걸릴 수 있습니다.' : '답을 찾는 중입니다…'}
          </p>
        )}

        {phase.kind === 'failed' && (
          <>
            <h2 ref={resultHeading} tabIndex={-1} className="ask-result__title">
              질문을 보내지 못했습니다
            </h2>
            <p className="warn">{phase.message}</p>
          </>
        )}

        {phase.kind === 'done' && <AskResult res={phase.res} headingRef={resultHeading} />}
      </section>
    </main>
  );
}

function AskResult({
  res,
  headingRef,
}: {
  res: AskResponse;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const view = describeAnswer(res);

  return (
    <>
      <h2 ref={headingRef} tabIndex={-1} className="ask-result__title">
        결과
      </h2>

      {/*
        서버는 근거가 확인되면 AI 문장 대신 늘 같은 고정 안내("관련 항목의 원문 카드를 확인해 주세요")를
        준다(#31). 그 문장을 그대로 띄우면 GROUNDED 와 PARTIAL 이 같은 말이 되므로,
        신뢰도별 설명은 화면이 정하고 결과의 중심은 아래 원문 카드에 둔다.
      */}
      {view.kind === 'answer' && (
        <div className={`answer answer--${view.confidence.toLowerCase()}`}>
          <ConfidenceBadge confidence={view.confidence} />
          <p className="answer__text">
            {view.confidence === 'GROUNDED'
              ? '질문과 관련해 확인된 항목을 찾았습니다.'
              : '관련 항목 중 일부만 확인됐습니다. 카드가 질문과 맞는지 직접 확인하세요.'}
          </p>
        </div>
      )}

      {view.kind === 'fallback' && (
        <p className="answer answer--fallback">지금은 자동 답변을 드릴 수 없습니다. 관련 항목입니다.</p>
      )}

      {view.kind === 'unknown' && (
        <div className="answer answer--unknown">
          <ConfidenceBadge confidence="UNKNOWN" />
          <p className="answer__text">아직 확인된 정보가 없습니다.</p>
          <p className="answer__hint">급하다면 주민센터에 문의하는 것이 가장 정확합니다.</p>
        </div>
      )}

      {/*
        확인된 정보로 답하지 못한 질문(GROUNDED 가 아닌 것)은 '이웃의 질문'에 올라간다.
        질문한 사람이 그걸 모르면 답이 달려도 다시 와 보지 않는다. 그 질문 위치로 바로 보낸다.
      */}
      {res.confidence !== 'GROUNDED' && (
        <p className="ask-next">
          이 질문은 &lsquo;이웃의 질문&rsquo;에 올라갔습니다. 먼저 와 본 주민이 답하면 거기서 볼 수 있습니다.{' '}
          <Link href={`/questions?status=OPEN#q-${res.questionId}`}>이웃의 질문에서 보기</Link>
        </p>
      )}

      {res.tasks.length > 0 && (
        <>
          <h3 className="ask-result__sub">
            {view.kind === 'answer' ? '확인된 항목' : '관련 있어 보이는 항목'} {res.tasks.length}건
          </h3>
          {res.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
          <p className="asof">기한 · 금액 · 장소는 카드의 원문을 기준으로 보세요. 최종 확인은 주민센터에 문의하세요.</p>
        </>
      )}
    </>
  );
}
