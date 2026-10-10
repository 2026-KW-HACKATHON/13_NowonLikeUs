'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AUTH_LIMITS, nicknameFieldError, readApiError } from '@/lib/authView';
import { loadSession } from '@/lib/useSession';
import type { KakaoSignupRequest, KakaoSignupResponse } from '@/lib/types';

/**
 * 카카오 첫 로그인 뒤 닉네임 정하기. 성공하면 서버가 세션 쿠키를 심고, 카카오 로그인을 시작한 화면으로 보낸다.
 * 칸 검사는 이메일 가입과 같은 규칙이다(`nicknameFieldError`).
 */
export default function KakaoSignupForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (formError) formErrorRef.current?.focus();
  }, [formError]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = nicknameFieldError(nickname);
    setFieldError(error);
    setFormError(null);
    if (error) {
      inputRef.current?.focus();
      return;
    }

    setSending(true);
    try {
      const body: KakaoSignupRequest = { nickname: nickname.trim() };
      const res = await fetch('/api/auth/kakao/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        // 10분이 지나 회원번호 쿠키가 사라졌다. 카카오 로그인부터 다시 해야 한다.
        if (res.status === 401) setExpired(true);
        setFormError(await readApiError(res, '가입하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
        setSending(false);
        return;
      }
      const { next } = (await res.json()) as KakaoSignupResponse;
      await loadSession(true);
      router.replace(next);
      router.refresh();
    } catch {
      setFormError('연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.');
      setSending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <div className="auth-field">
        <label className="auth-field__label" htmlFor="kakao-nickname">
          닉네임
        </label>
        <p id="kakao-nickname-hint" className="auth-field__hint">
          답변에 이 이름이 보입니다. {AUTH_LIMITS.nicknameMin}~{AUTH_LIMITS.nicknameMax}자. 실명은 피해 주세요.
        </p>
        <input
          ref={inputRef}
          id="kakao-nickname"
          name="nickname"
          className="text-input"
          type="text"
          autoComplete="nickname"
          maxLength={AUTH_LIMITS.nicknameMax}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          aria-describedby="kakao-nickname-hint"
          aria-invalid={fieldError ? true : undefined}
          aria-errormessage={fieldError ? 'kakao-nickname-error' : undefined}
          disabled={sending}
        />
        {fieldError && (
          <p id="kakao-nickname-error" className="field-error auth-field__error">
            {fieldError}
          </p>
        )}
      </div>

      {formError && (
        <p ref={formErrorRef} tabIndex={-1} className="warn auth-form__error" role="alert">
          {formError} {expired && <Link href="/login">로그인 화면으로</Link>}
        </p>
      )}

      <button type="submit" disabled={sending || expired}>
        {sending ? '가입하는 중…' : '이 닉네임으로 시작하기'}
      </button>
    </form>
  );
}
