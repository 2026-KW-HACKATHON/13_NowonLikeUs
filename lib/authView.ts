import {
  EMAIL_MAX,
  NICKNAME_MAX,
  NICKNAME_MIN,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN,
} from './authValidation';

/**
 * 로그인 · 가입 화면의 판정 로직.
 *
 * 서버 검증(`lib/authValidation.ts`)이 최종 기준이다. 여기 검사는 서버까지 가기 전에
 * 칸 바로 아래에 이유를 띄우기 위한 것이라, 한도는 서버와 같은 상수를 쓰고 세는 방식도 맞춘다.
 */

/** 입력칸 속성에 쓰는 한도. 서버 상수를 그대로 다시 내보낸다. */
export const AUTH_LIMITS = {
  passwordMin: PASSWORD_MIN,
  passwordMaxBytes: PASSWORD_MAX_BYTES,
  nicknameMin: NICKNAME_MIN,
  nicknameMax: NICKNAME_MAX,
  emailMax: EMAIL_MAX,
} as const;

/** 로그인 뒤 돌아갈 기본 화면 */
export const DEFAULT_NEXT = '/tasks';

/**
 * `?next=` 로 받은 돌아갈 주소를 이 사이트 안의 경로로만 제한한다.
 *
 * 그대로 쓰면 `?next=https://가짜사이트` 로 로그인 직후 다른 사이트로 보낼 수 있다(오픈 리다이렉트).
 * `//host` 와 `/\host` 는 브라우저가 다른 사이트로 해석하므로 막는다.
 */
export function safeNext(raw: string | string[] | undefined): string {
  if (typeof raw !== 'string') return DEFAULT_NEXT;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return DEFAULT_NEXT;
  // 제어 문자(탭 · 줄바꿈 등)는 브라우저가 지우고 해석해서 위 검사를 우회할 수 있다.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_NEXT;
  // 로그인 · 가입 화면으로 돌아가면 제자리를 맴돈다.
  if (/^\/(login|signup)(?=$|[/?#])/.test(raw)) return DEFAULT_NEXT;
  return raw;
}

/**
 * 카카오 로그인에서 돌아온 `?kakao=` 사유를 로그인 화면 문장으로. 모르는 값이면 null(아무것도 안 띄움).
 * 카카오가 준 오류 내용은 화면에 싣지 않는다 — 사유는 서버가 정한 세 가지뿐이다.
 */
export function kakaoErrorMessage(raw: string | string[] | undefined): string | null {
  if (raw === 'cancelled') return '카카오 로그인을 취소했습니다.';
  if (raw === 'failed') return '카카오 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.';
  if (raw === 'unavailable') return '지금은 카카오 로그인을 쓸 수 없습니다. 이메일로 로그인해 주세요.';
  return null;
}

/** 카카오 로그인 시작 주소. 로그인 뒤 돌아갈 화면을 함께 넘긴다(서버가 다시 검사한다). */
export function kakaoStartHref(next: string): string {
  return `/api/auth/kakao?next=${encodeURIComponent(next)}`;
}

export type FieldErrors = Partial<Record<'email' | 'password' | 'nickname', string>>;

/** 글자 수. 서버(`authValidation`)와 같이 이모지 · 한글 한 글자를 1로 센다. */
function charCount(text: string): number {
  return [...text].length;
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** 로그인 칸 검사. 비밀번호 규칙은 다시 따지지 않는다 — 틀리면 서버가 "맞지 않는다"고 답한다. */
export function loginFieldErrors(input: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.email.trim()) errors.email = '이메일을 입력해 주세요.';
  if (!input.password) errors.password = '비밀번호를 입력해 주세요.';
  return errors;
}

/** 가입 칸 검사. 이메일 형식은 서버가 판정한다 (규칙을 두 곳에 두면 한쪽만 바뀐다). */
export function signupFieldErrors(input: { email: string; password: string; nickname: string }): FieldErrors {
  const errors: FieldErrors = {};
  const { passwordMin, passwordMaxBytes, emailMax } = AUTH_LIMITS;

  const email = input.email.trim();
  if (!email) errors.email = '이메일을 입력해 주세요.';
  else if (email.length > emailMax) errors.email = `이메일은 ${emailMax}자까지 쓸 수 있습니다.`;

  // 비밀번호는 공백도 비밀번호의 일부라 지우지 않고 센다.
  if (!input.password) errors.password = '비밀번호를 입력해 주세요.';
  else if (charCount(input.password) < passwordMin) errors.password = `비밀번호는 ${passwordMin}자 이상이어야 합니다.`;
  else if (utf8Bytes(input.password) > passwordMaxBytes) {
    // 바이트는 사용자가 셀 수 없는 단위라 글자 수로 풀어 쓴다. 한글은 한 글자가 3바이트다.
    errors.password = `비밀번호가 너무 깁니다. 영문 ${passwordMaxBytes}자, 한글 ${Math.floor(passwordMaxBytes / 3)}자까지 쓸 수 있습니다.`;
  }

  const nicknameError = nicknameFieldError(input.nickname);
  if (nicknameError) errors.nickname = nicknameError;

  return errors;
}

/** 닉네임 칸 검사. 이메일 가입과 카카오 첫 로그인의 닉네임 정하기가 같이 쓴다. 문제없으면 null. */
export function nicknameFieldError(raw: string): string | null {
  const { nicknameMin, nicknameMax } = AUTH_LIMITS;
  const nickname = raw.trim();
  if (!nickname) return '닉네임을 입력해 주세요.';
  if (charCount(nickname) < nicknameMin || charCount(nickname) > nicknameMax) {
    return `닉네임은 ${nicknameMin}~${nicknameMax}자로 정해 주세요.`;
  }
  return null;
}

/** 서버 오류 본문(`{ error: string }`)의 문장을 꺼낸다. 없으면 `fallback`. */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' && body.error) {
      return body.error;
    }
  } catch {
    // 본문이 JSON 이 아니면 fallback 을 쓴다.
  }
  return fallback;
}
