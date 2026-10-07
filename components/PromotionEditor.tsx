'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { readApiError } from '@/lib/authView';
import { CATEGORY_LABEL, CONTRACT_LABEL, HOUSING_LABEL } from '@/lib/labels';
import { askerContext } from '@/lib/questionBoard';
import { audienceSummary, emptyForm, formFromDraft, toPromoteRequest, toggle, type PromoteForm } from '@/lib/promotionForm';
import type {
  ContractType,
  HousingType,
  PromoteDraftRequest,
  PromoteDraftResponse,
  PromoteResponse,
  PromotionQueueItem,
  TaskCategory,
} from '@/lib/types';

/** AI 초안을 이 시간 안에 못 받으면 빈 양식으로 넘어간다. 승격이 AI 를 기다리느라 멈추면 안 된다. */
const DRAFT_TIMEOUT_MS = 20_000;

type Origin = 'ai' | 'blank';
type Phase = { kind: 'drafting' } | { kind: 'editing'; origin: Origin };

const CATEGORIES = Object.keys(CATEGORY_LABEL) as TaskCategory[];
const HOUSINGS = Object.keys(HOUSING_LABEL) as HousingType[];
const CONTRACTS = Object.keys(CONTRACT_LABEL) as ContractType[];

/**
 * 질문 하나를 할 일로 정리하는 양식.
 *
 * AI 초안은 제안일 뿐이다. 금액 · 기한 · 장소는 AI 가 틀리기 쉬워서, 운영자가 원문과 대조했다는
 * 확인과 출처를 받아야만 발행 버튼이 동작한다 (CLAUDE.md — 확인되지 않은 데이터는 넣지 않는다).
 */
export default function PromotionEditor({
  item,
  onCancel,
  onPublished,
  onStale,
}: {
  item: PromotionQueueItem;
  onCancel: () => void;
  onPublished: (taskId: string, title: string) => void;
  onStale: () => void;
}) {
  const q = item.question;
  const [phase, setPhase] = useState<Phase>({ kind: 'drafting' });
  const [form, setForm] = useState<PromoteForm>(emptyForm);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DRAFT_TIMEOUT_MS);
    const body: PromoteDraftRequest = { questionId: q.id };
    fetch('/api/admin/promote/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then(async (res) => (res.ok ? ((await res.json()) as PromoteDraftResponse).draft : null))
      // 초안 API 가 없거나 실패해도 빈 양식으로 계속한다.
      .catch(() => null)
      .then((draft) => {
        if (ignore) return;
        if (draft) setForm(formFromDraft(draft));
        setPhase({ kind: 'editing', origin: draft ? 'ai' : 'blank' });
      });
    return () => {
      ignore = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [q.id]);

  useEffect(() => {
    if (error || stale) errorRef.current?.focus();
  }, [error, stale]);

  function set<K extends keyof PromoteForm>(key: K, value: PromoteForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!checked) {
      setError('내용을 직접 확인했는지 체크해 주세요.');
      return;
    }
    const request = toPromoteRequest(form, q.id);
    if (!request.ok) {
      setError(request.error);
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await fetch('/api/admin/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.value),
      });
      if (res.status === 409 || res.status === 404) {
        // 다른 운영자가 먼저 발행했거나 질문이 사라졌다. 고칠 수 있는 오류가 아니라 큐를 새로 봐야 한다.
        setStale(await readApiError(res, '이미 처리된 질문입니다.'));
        return;
      }
      if (!res.ok) {
        setError(await readApiError(res, '발행하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
        return;
      }
      const { taskId } = (await res.json()) as PromoteResponse;
      onPublished(taskId, request.value.task.title);
    } catch {
      setError('연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSending(false);
    }
  }

  const context = askerContext(q);

  return (
    <section className="editor" aria-labelledby={`${id}-title`}>
      <button type="button" className="back-button" onClick={onCancel} disabled={sending}>
        ← 승격 큐
      </button>
      <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} className="editor__title">
        할 일로 정리하기
      </h2>

      <div className="editor__source">
        <p className="editor__label">질문</p>
        <p className="editor__question">{q.text}</p>
        {context && <p className="qcard__context">{context}</p>}
        <p className="editor__label">주민 답변 · 운영자 확인 전</p>
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
      </div>

      {phase.kind === 'drafting' && (
        <p className="empty" role="status">
          AI 초안을 만드는 중입니다… 길어지면 빈 양식으로 넘어갑니다.
        </p>
      )}

      {phase.kind === 'editing' && (
        <form className="editor__form" onSubmit={handleSubmit} noValidate>
          <p className={phase.origin === 'ai' ? 'editor__origin editor__origin--ai' : 'editor__origin'}>
            {phase.origin === 'ai'
              ? 'AI 초안입니다. 특히 기한 · 금액 · 장소 · 노출 조건은 원문과 대조해 고치세요.'
              : 'AI 초안을 받지 못했습니다. 주민 답변과 확인한 자료를 보고 직접 작성하세요.'}
          </p>

          <TextField id={`${id}-t`} label="제목 — 뭘 해야 하나" value={form.title} onChange={(v) => set('title', v)} />
          <TextField id={`${id}-w`} label="안 하면 어떻게 되나" value={form.why} onChange={(v) => set('why', v)} multiline />
          <TextField id={`${id}-h`} label="어떻게 하나" value={form.howTo} onChange={(v) => set('howTo', v)} multiline />

          <fieldset>
            <legend>분류</legend>
            <div className="choices">
              {CATEGORIES.map((c) => (
                <label key={c} className="choice">
                  <input type="radio" name={`${id}-cat`} checked={form.category === c} onChange={() => set('category', c)} />
                  {CATEGORY_LABEL[c]}
                </label>
              ))}
            </div>
          </fieldset>

          <TextField
            id={`${id}-d`}
            label="기한 (이사일로부터 며칠 안)"
            hint={
              phase.origin === 'ai' && form.dueOffsetDays !== ''
                ? 'AI 가 제안한 값입니다. 법정 기한과 맞는지 꼭 확인하세요. 이사일과 상관없으면 비워 두세요.'
                : '숫자만 적습니다. 이사일과 상관없는 일이면 비워 두세요.'
            }
            value={form.dueOffsetDays}
            onChange={(v) => set('dueOffsetDays', v)}
            inputMode="numeric"
            warn={phase.origin === 'ai' && form.dueOffsetDays !== ''}
          />

          <TextField id={`${id}-l`} label="신청 페이지 링크 (선택)" value={form.linkUrl} onChange={(v) => set('linkUrl', v)} inputMode="url" />
          <TextField id={`${id}-pn`} label="장소 이름 (선택)" value={form.placeName} onChange={(v) => set('placeName', v)} />
          <TextField
            id={`${id}-pa`}
            label="장소 주소 (선택)"
            hint="기관 · 시설 주소만 적습니다. 개인 주소는 적지 않습니다."
            value={form.placeAddress}
            onChange={(v) => set('placeAddress', v)}
          />
          <TextField id={`${id}-pp`} label="전화번호 (선택)" value={form.placePhone} onChange={(v) => set('placePhone', v)} inputMode="tel" />

          <fieldset>
            <legend>누구에게 보여줄까요?</legend>
            <p className="editor__hint">아무것도 고르지 않으면 해당 항목은 조건 없음입니다.</p>
            <p className="editor__sublabel">주거형태</p>
            <div className="choices">
              {HOUSINGS.map((h) => (
                <label key={h} className="choice">
                  <input
                    type="checkbox"
                    checked={form.housingTypes.includes(h)}
                    onChange={(e) => set('housingTypes', toggle(form.housingTypes, h, e.target.checked))}
                  />
                  {HOUSING_LABEL[h]}
                </label>
              ))}
            </div>
            <p className="editor__sublabel">계약형태</p>
            <div className="choices">
              {CONTRACTS.map((c) => (
                <label key={c} className="choice">
                  <input
                    type="checkbox"
                    checked={form.contractTypes.includes(c)}
                    onChange={(e) => set('contractTypes', toggle(form.contractTypes, c, e.target.checked))}
                  />
                  {CONTRACT_LABEL[c]}
                </label>
              ))}
            </div>
            <p className="editor__sublabel">해당하는 사람만</p>
            <div className="choices">
              <label className="choice">
                <input type="checkbox" checked={form.requiresCar} onChange={(e) => set('requiresCar', e.target.checked)} />
                차 있는 사람
              </label>
              <label className="choice">
                <input type="checkbox" checked={form.requiresPet} onChange={(e) => set('requiresPet', e.target.checked)} />
                반려동물 있는 사람
              </label>
              <label className="choice">
                <input type="checkbox" checked={form.studentOnly} onChange={(e) => set('studentOnly', e.target.checked)} />
                학생
              </label>
            </div>
            <p className="audience" aria-live="polite">
              보이는 사람: <strong>{audienceSummary(form, { housing: HOUSING_LABEL, contract: CONTRACT_LABEL })}</strong>
            </p>
          </fieldset>

          <TextField
            id={`${id}-s`}
            label="출처 — 무엇으로 확인했나"
            hint="예: 주민 답변 + 노원구청 자원순환과 전화 확인 (10/7). 나중에 정보를 다시 확인할 때 근거가 됩니다."
            value={form.sourceNote}
            onChange={(v) => set('sourceNote', v)}
            multiline
          />

          <label className="confirm-check">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            이 내용을 공식 자료나 기관에 직접 확인했습니다. 주민 답변만으로 발행하지 않습니다.
          </label>

          {(error || stale) && (
            <p ref={errorRef} tabIndex={-1} className="warn editor__error" role="alert">
              {stale ?? error}
            </p>
          )}

          {stale ? (
            <button type="button" className="secondary-button" onClick={onStale}>
              승격 큐 새로 보기
            </button>
          ) : (
            <div className="answer-form__actions">
              <button type="submit" disabled={sending}>
                {sending ? '발행하는 중…' : '할 일로 발행'}
              </button>
              <button type="button" className="secondary-button" onClick={onCancel} disabled={sending}>
                취소
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}

function TextField({
  id,
  label,
  hint,
  value,
  onChange,
  multiline = false,
  inputMode,
  warn = false,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  inputMode?: 'numeric' | 'url' | 'tel';
  warn?: boolean;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="auth-field">
      <label className="auth-field__label" htmlFor={id}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className={warn ? 'auth-field__hint editor__warn-hint' : 'auth-field__hint'}>
          {hint}
        </p>
      )}
      {multiline ? (
        <textarea
          id={id}
          className="ask-input editor__textarea"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hintId}
        />
      ) : (
        <input
          id={id}
          className={warn ? 'text-input editor__warn-input' : 'text-input'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          aria-describedby={hintId}
        />
      )}
    </div>
  );
}
