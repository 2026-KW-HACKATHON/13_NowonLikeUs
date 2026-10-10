import { describe, it, expect } from 'vitest';
import {
  checkStateCookie,
  encodeStateCookie,
  kakaoAuthorizeUrl,
  kakaoCallbackUrl,
  kakaoConfig,
  kakaoTokenBody,
  parseKakaoId,
  parseKakaoToken,
  readCallbackQuery,
  signKakaoPending,
  verifyKakaoPending,
} from '@/lib/kakao';
import { signSession, verifySession } from '@/lib/session';

const SECRET = 'x'.repeat(32);
const STATE = 'a'.repeat(43);

describe('kakaoConfig', () => {
  it('REST API 키가 없거나 비면 끈다', () => {
    expect(kakaoConfig({})).toBeNull();
    expect(kakaoConfig({ KAKAO_REST_API_KEY: '  ' })).toBeNull();
  });

  it('client secret 은 있을 때만 담는다', () => {
    expect(kakaoConfig({ KAKAO_REST_API_KEY: 'key' })).toEqual({ clientId: 'key' });
    expect(kakaoConfig({ KAKAO_REST_API_KEY: 'key', KAKAO_CLIENT_SECRET: '' })).toEqual({ clientId: 'key' });
    expect(kakaoConfig({ KAKAO_REST_API_KEY: ' key ', KAKAO_CLIENT_SECRET: 'sec' })).toEqual({ clientId: 'key', clientSecret: 'sec' });
  });
});

describe('kakaoAuthorizeUrl', () => {
  it('인가 코드 방식 주소를 만든다. 추가 동의(scope)는 요청하지 않는다', () => {
    const url = new URL(kakaoAuthorizeUrl({ clientId: 'key', redirectUri: kakaoCallbackUrl('https://a.app'), state: STATE }));
    expect(url.origin + url.pathname).toBe('https://kauth.kakao.com/oauth/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('key');
    expect(url.searchParams.get('redirect_uri')).toBe('https://a.app/api/auth/kakao/callback');
    expect(url.searchParams.get('state')).toBe(STATE);
    expect(url.searchParams.has('scope')).toBe(false);
  });
});

describe('kakaoTokenBody', () => {
  it('client secret 이 없으면 보내지 않는다', () => {
    const body = kakaoTokenBody({ clientId: 'key', redirectUri: 'r', code: 'c' });
    expect(Object.fromEntries(body)).toEqual({ grant_type: 'authorization_code', client_id: 'key', redirect_uri: 'r', code: 'c' });
  });

  it('있으면 같이 보낸다', () => {
    expect(kakaoTokenBody({ clientId: 'key', clientSecret: 's', redirectUri: 'r', code: 'c' }).get('client_secret')).toBe('s');
  });
});

describe('parseKakaoToken', () => {
  it('access_token 만 꺼낸다', () => {
    expect(parseKakaoToken({ access_token: 't', refresh_token: 'r' })).toBe('t');
  });

  it.each([null, 'x', {}, { access_token: '' }, { access_token: 1 }])('모양이 다르면 null: %j', (json) => {
    expect(parseKakaoToken(json)).toBeNull();
  });
});

describe('parseKakaoId', () => {
  it('숫자 회원번호를 문자열로. 다른 필드는 무시한다', () => {
    expect(parseKakaoId({ id: 1234567890, kakao_account: { profile: { nickname: '홍길동' } } })).toBe('1234567890');
  });

  it('문자열 숫자도 받는다', () => {
    expect(parseKakaoId({ id: '1234567890' })).toBe('1234567890');
  });

  it.each([null, {}, { id: 0 }, { id: -1 }, { id: 1.5 }, { id: 2 ** 60 }, { id: '01' }, { id: '12a' }, { id: '' }])(
    '회원번호가 아니면 null: %j',
    (json) => {
      expect(parseKakaoId(json)).toBeNull();
    },
  );
});

describe('readCallbackQuery', () => {
  it('코드와 state 를 꺼낸다', () => {
    expect(readCallbackQuery(new URLSearchParams({ code: 'c', state: 's' }))).toEqual({ code: 'c', state: 's' });
  });

  it('동의 화면에서 취소하면 cancelled', () => {
    expect(readCallbackQuery(new URLSearchParams({ error: 'access_denied', state: 's' }))).toEqual({ error: 'cancelled' });
  });

  it('그 밖의 오류나 빠진 값은 failed', () => {
    expect(readCallbackQuery(new URLSearchParams({ error: 'server_error' }))).toEqual({ error: 'failed' });
    expect(readCallbackQuery(new URLSearchParams({ code: 'c' }))).toEqual({ error: 'failed' });
    expect(readCallbackQuery(new URLSearchParams({ state: 's' }))).toEqual({ error: 'failed' });
  });
});

describe('checkStateCookie', () => {
  it('같은 state 면 돌아갈 화면을 돌려준다', () => {
    expect(checkStateCookie(encodeStateCookie(STATE, '/questions?status=MINE'), STATE)).toEqual({ next: '/questions?status=MINE' });
  });

  it('state 가 다르거나 쿠키가 없으면 null (내가 시작한 로그인이 아니다)', () => {
    expect(checkStateCookie(encodeStateCookie(STATE, '/tasks'), 'b'.repeat(43))).toBeNull();
    expect(checkStateCookie(encodeStateCookie(STATE, '/tasks'), STATE.slice(1))).toBeNull();
    expect(checkStateCookie(undefined, STATE)).toBeNull();
  });

  it('깨진 쿠키 · 너무 짧은 state 는 null', () => {
    expect(checkStateCookie('not json', STATE)).toBeNull();
    expect(checkStateCookie(JSON.stringify({ next: '/tasks' }), STATE)).toBeNull();
    expect(checkStateCookie(encodeStateCookie('short', '/tasks'), 'short')).toBeNull();
  });

  it('쿠키 속 next 도 다시 거른다 — 다른 사이트로 보내지 않는다', () => {
    expect(checkStateCookie(encodeStateCookie(STATE, 'https://evil.example'), STATE)).toEqual({ next: '/tasks' });
    expect(checkStateCookie(encodeStateCookie(STATE, '//evil.example'), STATE)).toEqual({ next: '/tasks' });
  });
});

describe('카카오 첫 로그인 토큰', () => {
  it('서명한 회원번호와 돌아갈 화면을 그대로 읽는다', async () => {
    const token = await signKakaoPending({ kakaoId: '1234567890', next: '/ask' }, SECRET);
    expect(await verifyKakaoPending(token, SECRET)).toEqual({ kakaoId: '1234567890', next: '/ask' });
  });

  it('10분이 지나면 받지 않는다', async () => {
    const token = await signKakaoPending({ kakaoId: '1234567890', next: '/ask' }, SECRET, new Date(Date.now() - 11 * 60_000));
    expect(await verifyKakaoPending(token, SECRET)).toBeNull();
  });

  it('다른 비밀키로 만든 토큰 · 빈 값은 받지 않는다', async () => {
    const token = await signKakaoPending({ kakaoId: '1234567890', next: '/ask' }, 'y'.repeat(32));
    expect(await verifyKakaoPending(token, SECRET)).toBeNull();
    expect(await verifyKakaoPending(undefined, SECRET)).toBeNull();
  });

  it('세션 토큰을 이 자리에 쓸 수 없다', async () => {
    const session = await signSession({ id: 'u1', nickname: '주민', role: 'MEMBER' }, SECRET);
    expect(await verifyKakaoPending(session, SECRET)).toBeNull();
  });

  it('이 토큰을 세션으로 쓸 수 없다', async () => {
    const pending = await signKakaoPending({ kakaoId: '1234567890', next: '/ask' }, SECRET);
    expect(await verifySession(pending, SECRET)).toBeNull();
  });
});
