import type { LoginRequest, SignupRequest } from './types';

/*
 * 회원가입 · 로그인 입력 검증. 서버 코드를 import 하지 않는다.
 * 화면도 같은 상수를 가져다 입력칸의 maxLength 등에 쓴다 — 한도를 두 곳에 적으면 한쪽만 바뀐다.
 */

export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
/** bcrypt 는 72바이트 뒤를 말없이 잘라 버린다. 한글은 한 글자가 3바이트라 24자가 한계다. */
export const PASSWORD_MAX_BYTES = 72;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BAD_REQUEST = '요청 형식이 올바르지 않습니다.';

/** 앞뒤 공백을 지우고 소문자로 맞춘다. DB 의 @unique 는 대소문자를 구분하므로 저장·조회 모두 이걸 거친다. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 글자 수. 한글 한 글자를 1로 센다. */
function charCount(text: string): number {
  return [...text].length;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * 가입 입력 검증. 통과하면 정규화된 값만 돌려준다.
 * 요청에 role 이 실려 와도 결과에 담지 않는다 — 가입은 항상 MEMBER 다.
 */
export function validateSignup(input: unknown): ValidationResult<SignupRequest> {
  if (!isRecord(input)) return { ok: false, error: BAD_REQUEST };
  const { email, password, nickname } = input;
  if (typeof email !== 'string' || typeof password !== 'string' || typeof nickname !== 'string') {
    return { ok: false, error: BAD_REQUEST };
  }

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail.length > EMAIL_MAX || !EMAIL_PATTERN.test(normalizedEmail)) {
    return { ok: false, error: '이메일 형식이 올바르지 않습니다.' };
  }

  // 비밀번호는 공백까지 그대로 쓴다. 사용자가 일부러 넣은 공백일 수 있다.
  if (charCount(password) < PASSWORD_MIN) {
    return { ok: false, error: `비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.` };
  }
  if (byteLength(password) > PASSWORD_MAX_BYTES) {
    return { ok: false, error: '비밀번호가 너무 깁니다. 영문 72자, 한글 24자 이하로 입력해 주세요.' };
  }

  const checkedNickname = validateNickname(nickname);
  if (!checkedNickname.ok) return checkedNickname;

  return { ok: true, value: { email: normalizedEmail, password, nickname: checkedNickname.value } };
}

/** 닉네임 검증. 이메일 가입과 카카오 가입이 같은 규칙을 쓴다. 통과하면 앞뒤 공백을 지운 값. */
export function validateNickname(nickname: string): ValidationResult<string> {
  const trimmed = nickname.trim();
  const length = charCount(trimmed);
  if (length < NICKNAME_MIN || length > NICKNAME_MAX) {
    return { ok: false, error: `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해 주세요.` };
  }
  return { ok: true, value: trimmed };
}

/** 카카오 첫 로그인 뒤 닉네임 정하기 요청 검증. */
export function validateKakaoSignup(input: unknown): ValidationResult<{ nickname: string }> {
  if (!isRecord(input) || typeof input.nickname !== 'string') return { ok: false, error: BAD_REQUEST };
  const checked = validateNickname(input.nickname);
  return checked.ok ? { ok: true, value: { nickname: checked.value } } : checked;
}

/**
 * 로그인 입력 검증. 길이·형식 규칙은 다시 따지지 않는다.
 * 틀리면 그냥 "맞지 않는다"가 되어야 가입 규칙이 바뀐 뒤에도 옛 계정이 로그인할 수 있다.
 */
export function validateLogin(input: unknown): ValidationResult<LoginRequest> {
  if (!isRecord(input)) return { ok: false, error: BAD_REQUEST };
  const { email, password } = input;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { ok: false, error: BAD_REQUEST };
  }

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail === '' || password === '') {
    return { ok: false, error: '이메일과 비밀번호를 입력해 주세요.' };
  }

  return { ok: true, value: { email: normalizedEmail, password } };
}
