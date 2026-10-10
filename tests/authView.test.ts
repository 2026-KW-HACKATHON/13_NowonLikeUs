import { describe, it, expect } from 'vitest';
import {
  AUTH_LIMITS, DEFAULT_NEXT, kakaoErrorMessage, kakaoStartHref, loginFieldErrors, nicknameFieldError, readApiError, safeNext,
  signupFieldErrors,
} from '@/lib/authView';

describe('kakaoErrorMessage', () => {
  it.each(['cancelled', 'failed', 'unavailable'])('알려진 사유는 문장으로: %s', (raw) => {
    expect(kakaoErrorMessage(raw)).toEqual(expect.any(String));
  });

  it.each([undefined, '', 'KOE006', ['failed']])('모르는 값이면 아무것도 안 띄운다: %j', (raw) => {
    expect(kakaoErrorMessage(raw)).toBeNull();
  });
});

describe('kakaoStartHref', () => {
  it('돌아갈 화면을 인코딩해서 넘긴다', () => {
    expect(kakaoStartHref('/questions?status=MINE#q-1')).toBe('/api/auth/kakao?next=%2Fquestions%3Fstatus%3DMINE%23q-1');
  });
});

describe('nicknameFieldError', () => {
  it('비었거나 길이가 안 맞으면 이유를, 맞으면 null', () => {
    expect(nicknameFieldError('  ')).toBe('닉네임을 입력해 주세요.');
    expect(nicknameFieldError('가')).toContain('자로 정해 주세요');
    expect(nicknameFieldError('가'.repeat(AUTH_LIMITS.nicknameMax + 1))).toContain('자로 정해 주세요');
    expect(nicknameFieldError(' 월계주민 ')).toBeNull();
  });
});

describe('safeNext', () => {
  it.each(['/tasks', '/ask', '/tasks/abc?x=1', '/questions#a'])('사이트 안 경로는 그대로 둔다: %s', (path) => {
    expect(safeNext(path)).toBe(path);
  });

  // 로그인 직후 다른 사이트로 보내는 오픈 리다이렉트를 막는다.
  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'tasks',
    '/\t/evil.example',
    '/\n/evil.example',
  ])('다른 사이트로 갈 수 있는 값은 기본 화면으로: %j', (raw) => {
    expect(safeNext(raw)).toBe(DEFAULT_NEXT);
  });

  it.each([undefined, '', ['/ask', '/tasks']])('없거나 여러 개면 기본 화면으로: %j', (raw) => {
    expect(safeNext(raw)).toBe(DEFAULT_NEXT);
  });

  it.each(['/login', '/signup', '/login?next=/ask', '/signup/'])('로그인 · 가입 화면으로는 돌아가지 않는다: %s', (raw) => {
    expect(safeNext(raw)).toBe(DEFAULT_NEXT);
  });

  it('이름만 비슷한 경로는 막지 않는다', () => {
    expect(safeNext('/loginhelp')).toBe('/loginhelp');
  });
});

describe('loginFieldErrors', () => {
  it('둘 다 있으면 오류가 없다', () => {
    expect(loginFieldErrors({ email: 'a@b.com', password: 'x' })).toEqual({});
  });

  it('비어 있는 칸마다 오류를 준다', () => {
    const errors = loginFieldErrors({ email: '  ', password: '' });
    expect(Object.keys(errors).sort()).toEqual(['email', 'password']);
  });

  // 가입 규칙이 바뀌어도 옛 계정은 로그인할 수 있어야 한다.
  it('짧은 비밀번호도 로그인에서는 막지 않는다', () => {
    expect(loginFieldErrors({ email: 'a@b.com', password: '1' })).toEqual({});
  });
});

describe('signupFieldErrors', () => {
  const ok = { email: 'a@b.com', password: 'abcd1234', nickname: '월계주민' };

  it('정상 입력은 오류가 없다', () => {
    expect(signupFieldErrors(ok)).toEqual({});
  });

  it(`비밀번호는 ${AUTH_LIMITS.passwordMin}자부터 허용한다`, () => {
    expect(signupFieldErrors({ ...ok, password: 'a'.repeat(AUTH_LIMITS.passwordMin - 1) }).password).toBeDefined();
    expect(signupFieldErrors({ ...ok, password: 'a'.repeat(AUTH_LIMITS.passwordMin) }).password).toBeUndefined();
  });

  // 서버(bcrypt)는 72바이트 뒤를 잘라 버린다. 글자 수가 아니라 바이트로 센다.
  it('비밀번호는 바이트로 상한을 센다', () => {
    expect(signupFieldErrors({ ...ok, password: '가'.repeat(24) }).password).toBeUndefined();
    expect(signupFieldErrors({ ...ok, password: '가'.repeat(25) }).password).toBeDefined();
    expect(signupFieldErrors({ ...ok, password: 'a'.repeat(72) }).password).toBeUndefined();
    expect(signupFieldErrors({ ...ok, password: 'a'.repeat(73) }).password).toBeDefined();
  });

  it('비밀번호 공백은 지우지 않고 센다', () => {
    expect(signupFieldErrors({ ...ok, password: '   abcd ' }).password).toBeUndefined();
  });

  it(`닉네임은 앞뒤 공백을 지우고 ${AUTH_LIMITS.nicknameMin}~${AUTH_LIMITS.nicknameMax}자`, () => {
    expect(signupFieldErrors({ ...ok, nickname: ' 가 ' }).nickname).toBeDefined();
    expect(signupFieldErrors({ ...ok, nickname: '가나' }).nickname).toBeUndefined();
    expect(signupFieldErrors({ ...ok, nickname: '가'.repeat(AUTH_LIMITS.nicknameMax) }).nickname).toBeUndefined();
    expect(signupFieldErrors({ ...ok, nickname: '가'.repeat(AUTH_LIMITS.nicknameMax + 1) }).nickname).toBeDefined();
  });

  // 서버(authValidation)와 세는 방식이 다르면 화면은 통과시키고 서버는 막는 일이 생긴다.
  it('이모지도 한 글자로 센다 (서버와 같은 방식)', () => {
    expect(signupFieldErrors({ ...ok, nickname: '😀😀' }).nickname).toBeUndefined();
    expect(signupFieldErrors({ ...ok, nickname: '😀' }).nickname).toBeDefined();
    expect(signupFieldErrors({ ...ok, password: '😀'.repeat(7) }).password).toBeDefined();
  });

  it('빈 이메일과 너무 긴 이메일은 막는다', () => {
    expect(signupFieldErrors({ ...ok, email: ' ' }).email).toBeDefined();
    expect(signupFieldErrors({ ...ok, email: `${'a'.repeat(250)}@b.co` }).email).toBeDefined();
  });

  it('오류마다 화면에 띄울 문장이 있다', () => {
    const errors = signupFieldErrors({ email: '', password: '', nickname: '' });
    expect(Object.values(errors).every((m) => typeof m === 'string' && m.length > 0)).toBe(true);
    expect(Object.keys(errors).sort()).toEqual(['email', 'nickname', 'password']);
  });
});

describe('readApiError', () => {
  it('서버 문장을 그대로 꺼낸다', async () => {
    const res = new Response(JSON.stringify({ error: '이미 가입된 이메일입니다.' }), { status: 409 });
    expect(await readApiError(res, '기본')).toBe('이미 가입된 이메일입니다.');
  });

  it.each(['<html>500</html>', JSON.stringify({ message: 'x' }), JSON.stringify({ error: '' })])(
    '문장을 못 꺼내면 기본 문장: %s',
    async (body) => {
      expect(await readApiError(new Response(body, { status: 500 }), '기본')).toBe('기본');
    },
  );
});
