'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AUTH_LIMITS, loginFieldErrors, readApiError, signupFieldErrors, type FieldErrors } from '@/lib/authView';
import type { LoginRequest, SignupRequest } from '@/lib/types';

type Mode = 'login' | 'signup';

const COPY = {
  login: {
    endpoint: '/api/auth/login',
    submit: '로그인',
    sending: '로그인하는 중…',
    failed: '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  },
  signup: {
    endpoint: '/api/auth/signup',
    submit: '가입하기',
    sending: '가입하는 중…',
    failed: '가입하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  },
} as const;

/**
 * 로그인 · 가입 양식.
 *
 * 세션은 서버가 httpOnly 쿠키로 심는다. 화면은 토큰을 만지지 않고, 성공하면 `next` 로 이동만 한다.
 * 칸 검사는 서버까지 가기 전에 이유를 칸 아래 띄우는 용도이고, 최종 판정은 서버 응답의 `error` 문장이다.
 */
export default function AuthForm({ mode, next }: { mode: Mode; next: string }) {
  const router = useRouter();
  const copy = COPY[mode];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  // 서버가 거절하면 그 문장으로 초점을 옮긴다. 스크린리더 사용자가 왜 안 됐는지 바로 듣는다.
  useEffect(() => {
    if (formError) formErrorRef.current?.focus();
  }, [formError]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = mode === 'login' ? loginFieldErrors({ email, password }) : signupFieldErrors({ email, password, nickname });
    setFieldErrors(errors);
    setFormError(null);
    const firstInvalid = (['email', 'password', 'nickname'] as const).find((key) => errors[key]);
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    // 비밀번호는 공백도 비밀번호의 일부라 다듬지 않는다. 이메일 정규화는 서버가 한다.
    const body: LoginRequest | SignupRequest =
      mode === 'login' ? { email: email.trim(), password } : { email: email.trim(), password, nickname: nickname.trim() };

    setSending(true);
    try {
      const res = await fetch(copy.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setFormError(await readApiError(res, copy.failed));
        setSending(false);
        return;
      }
      // 뒤로 가기로 로그인 화면에 돌아오지 않게 replace. refresh 로 서버 컴포넌트가 새 쿠키를 읽게 한다.
      router.replace(next);
      router.refresh();
    } catch {
      setFormError('연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.');
      setSending(false);
    }
  }

  const other = mode === 'login'
    ? { text: '처음이신가요?', label: '가입하기', href: `/signup?next=${encodeURIComponent(next)}` }
    : { text: '이미 계정이 있나요?', label: '로그인', href: `/login?next=${encodeURIComponent(next)}` };

  return (
    <>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Field
          id="auth-email"
          name="email"
          label="이메일"
          error={fieldErrors.email}
          input={{
            type: 'email',
            inputMode: 'email',
            autoComplete: 'email',
            autoCapitalize: 'none',
            spellCheck: false,
            maxLength: AUTH_LIMITS.emailMax,
            value: email,
            onChange: (e) => setEmail(e.target.value),
          }}
          disabled={sending}
        />

        {mode === 'signup' && (
          <Field
            id="auth-nickname"
            name="nickname"
            label="닉네임"
            hint={`답변에 이 이름이 보입니다. ${AUTH_LIMITS.nicknameMin}~${AUTH_LIMITS.nicknameMax}자. 실명은 피해 주세요.`}
            error={fieldErrors.nickname}
            input={{
              type: 'text',
              autoComplete: 'nickname',
              maxLength: AUTH_LIMITS.nicknameMax,
              value: nickname,
              onChange: (e) => setNickname(e.target.value),
            }}
            disabled={sending}
          />
        )}

        <Field
          id="auth-password"
          name="password"
          label="비밀번호"
          hint={mode === 'signup' ? `${AUTH_LIMITS.passwordMin}자 이상` : undefined}
          error={fieldErrors.password}
          input={{
            type: showPassword ? 'text' : 'password',
            autoComplete: mode === 'login' ? 'current-password' : 'new-password',
            autoCapitalize: 'none',
            spellCheck: false,
            value: password,
            onChange: (e) => setPassword(e.target.value),
          }}
          disabled={sending}
        />
        <label className="auth-reveal">
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          비밀번호 보기
        </label>

        {formError && (
          <p ref={formErrorRef} tabIndex={-1} className="warn auth-form__error" role="alert">
            {formError}
          </p>
        )}

        <button type="submit" disabled={sending}>
          {sending ? copy.sending : copy.submit}
        </button>
      </form>

      <p className="auth-switch">
        {other.text} <Link href={other.href}>{other.label}</Link>
      </p>
    </>
  );
}

function Field({
  id,
  name,
  label,
  hint,
  error,
  input,
  disabled,
}: {
  id: string;
  name: 'email' | 'password' | 'nickname';
  label: string;
  hint?: string;
  error?: string;
  input: React.InputHTMLAttributes<HTMLInputElement>;
  disabled: boolean;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="auth-field">
      <label className="auth-field__label" htmlFor={id}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className="auth-field__hint">
          {hint}
        </p>
      )}
      <input
        {...input}
        id={id}
        name={name}
        className="text-input"
        aria-describedby={hintId}
        aria-invalid={error ? true : undefined}
        aria-errormessage={errorId}
        disabled={disabled}
      />
      {error && (
        <p id={errorId} className="field-error auth-field__error">
          {error}
        </p>
      )}
    </div>
  );
}
