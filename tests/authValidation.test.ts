import { describe, it, expect } from 'vitest';
import {
  NICKNAME_MAX,
  NICKNAME_MIN,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN,
  normalizeEmail,
  validateKakaoSignup,
  validateLogin,
  validateNickname,
  validateSignup,
} from '@/lib/authValidation';

const ok = { email: 'student@example.com', password: 'abcd1234', nickname: '월계주민' };

describe('validateNickname', () => {
  it('앞뒤 공백을 지운 값을 돌려준다', () => {
    expect(validateNickname('  월계주민 ')).toEqual({ ok: true, value: '월계주민' });
  });

  it('길이가 안 맞으면 거절', () => {
    expect(validateNickname('가'.repeat(NICKNAME_MIN - 1)).ok).toBe(false);
    expect(validateNickname('가'.repeat(NICKNAME_MAX + 1)).ok).toBe(false);
  });
});

describe('validateKakaoSignup', () => {
  it('닉네임만 받는다 — 본문에 실린 회원번호 · role 은 결과에 담지 않는다', () => {
    expect(validateKakaoSignup({ nickname: ' 이웃 ', kakaoId: '999', role: 'ADMIN' })).toEqual({ ok: true, value: { nickname: '이웃' } });
  });

  it.each([null, 'x', {}, { nickname: 3 }])('모양이 다르면 요청 형식 오류: %j', (input) => {
    expect(validateKakaoSignup(input)).toEqual({ ok: false, error: '요청 형식이 올바르지 않습니다.' });
  });

  it('길이가 안 맞으면 닉네임 규칙 문장', () => {
    const result = validateKakaoSignup({ nickname: '가' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('닉네임은');
  });
});

describe('normalizeEmail', () => {
  it('앞뒤 공백을 지우고 소문자로 맞춘다', () => {
    expect(normalizeEmail('  Student@Example.COM ')).toBe('student@example.com');
  });
});

describe('validateSignup', () => {
  it('정상 입력은 통과하고 이메일은 정규화돼서 나온다', () => {
    const result = validateSignup({ ...ok, email: ' Student@Example.com ' });
    expect(result).toEqual({
      ok: true,
      value: { email: 'student@example.com', password: 'abcd1234', nickname: '월계주민' },
    });
  });

  it.each(['', 'plain', 'a@', '@b.com', 'a b@c.com', 'a@b'])('이메일 형식이 아니면 거절한다: %j', (email) => {
    expect(validateSignup({ ...ok, email }).ok).toBe(false);
  });

  it('이메일이 254자를 넘으면 거절한다', () => {
    expect(validateSignup({ ...ok, email: `${'a'.repeat(250)}@b.co` }).ok).toBe(false);
  });

  it(`비밀번호는 ${PASSWORD_MIN}자 미만이면 거절하고 ${PASSWORD_MIN}자는 허용한다`, () => {
    expect(validateSignup({ ...ok, password: 'a'.repeat(PASSWORD_MIN - 1) }).ok).toBe(false);
    expect(validateSignup({ ...ok, password: 'a'.repeat(PASSWORD_MIN) }).ok).toBe(true);
  });

  // bcrypt 는 72바이트 뒤를 말없이 잘라 버린다. 한글은 한 글자가 3바이트라 24자가 한계다.
  it(`비밀번호가 ${PASSWORD_MAX_BYTES}바이트를 넘으면 거절한다 (글자 수가 아니라 바이트)`, () => {
    expect(validateSignup({ ...ok, password: '가'.repeat(24) }).ok).toBe(true);
    expect(validateSignup({ ...ok, password: '가'.repeat(25) }).ok).toBe(false);
    expect(validateSignup({ ...ok, password: 'a'.repeat(73) }).ok).toBe(false);
  });

  it('비밀번호 앞뒤 공백은 지우지 않는다', () => {
    const result = validateSignup({ ...ok, password: '  abcd1234  ' });
    expect(result.ok && result.value.password).toBe('  abcd1234  ');
  });

  it(`닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자다 (앞뒤 공백을 지운 뒤 센다)`, () => {
    expect(validateSignup({ ...ok, nickname: '가' }).ok).toBe(false);
    expect(validateSignup({ ...ok, nickname: '가나' }).ok).toBe(true);
    expect(validateSignup({ ...ok, nickname: '가'.repeat(NICKNAME_MAX) }).ok).toBe(true);
    expect(validateSignup({ ...ok, nickname: '가'.repeat(NICKNAME_MAX + 1) }).ok).toBe(false);
    expect(validateSignup({ ...ok, nickname: '  가  ' }).ok).toBe(false);
  });

  // 가입으로 ADMIN 이 만들어지면 안 된다. 요청에 role 이 실려 와도 결과에서 버린다.
  it('요청에 role 이 있어도 결과에 담기지 않는다', () => {
    const result = validateSignup({ ...ok, role: 'ADMIN' });
    expect(result.ok).toBe(true);
    expect(result.ok && 'role' in result.value).toBe(false);
  });

  it.each([null, undefined, 'text', 42, []])('객체가 아니면 거절한다: %j', (input) => {
    expect(validateSignup(input).ok).toBe(false);
  });

  it('문자열이 아닌 필드는 거절한다', () => {
    expect(validateSignup({ ...ok, password: 12345678 }).ok).toBe(false);
    expect(validateSignup({ ...ok, nickname: null }).ok).toBe(false);
  });

  it('거절할 때는 화면에 그대로 띄울 문장을 돌려준다', () => {
    const result = validateSignup({ ...ok, email: 'nope' });
    expect(!result.ok && result.error.length > 0).toBe(true);
  });
});

describe('validateLogin', () => {
  it('이메일을 정규화하고 비밀번호는 그대로 둔다', () => {
    expect(validateLogin({ email: ' A@B.com ', password: 'x' })).toEqual({
      ok: true,
      value: { email: 'a@b.com', password: 'x' },
    });
  });

  // 로그인에서는 길이·형식 규칙을 다시 따지지 않는다. 틀리면 그냥 "맞지 않는다"가 되어야
  // 가입 규칙이 바뀐 뒤에도 옛 계정이 로그인할 수 있고, 규칙이 새어 나가지도 않는다.
  it('비밀번호가 짧아도 형식 오류로 막지 않는다', () => {
    expect(validateLogin({ email: 'a@b.com', password: 'x' }).ok).toBe(true);
  });

  it('비어 있으면 거절한다', () => {
    expect(validateLogin({ email: '', password: 'x' }).ok).toBe(false);
    expect(validateLogin({ email: 'a@b.com', password: '' }).ok).toBe(false);
  });

  it.each([null, 'text', []])('객체가 아니면 거절한다: %j', (input) => {
    expect(validateLogin(input).ok).toBe(false);
  });
});
