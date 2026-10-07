import { describe, it, expect } from 'vitest';
import { UnsecuredJWT, decodeJwt } from 'jose';
import { SESSION_MAX_AGE_SECONDS, signSession, verifySession } from '@/lib/session';
import type { SessionUser } from '@/lib/types';

const SECRET = 'test-secret-test-secret-test-secret-0123';
const user: SessionUser = { id: 'u1', nickname: '월계주민', role: 'MEMBER' };

describe('signSession · verifySession', () => {
  it('서명한 토큰을 검증하면 같은 사용자가 나온다', async () => {
    const token = await signSession(user, SECRET);
    expect(await verifySession(token, SECRET)).toEqual(user);
  });

  it('ADMIN 역할도 그대로 왕복한다', async () => {
    const admin: SessionUser = { ...user, role: 'ADMIN' };
    expect(await verifySession(await signSession(admin, SECRET), SECRET)).toEqual(admin);
  });

  it('다른 비밀키로 서명한 토큰은 null 이다', async () => {
    const token = await signSession(user, `${SECRET}-other`);
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  it('토큰이 한 글자라도 바뀌면 null 이다', async () => {
    const token = await signSession(user, SECRET);
    const tampered = `${token.slice(0, -2)}${token.endsWith('aa') ? 'bb' : 'aa'}`;
    expect(await verifySession(tampered, SECRET)).toBeNull();
  });

  // 지나간 시각을 넘겨서 "발급된 지 오래된" 토큰을 만든다. 시간을 기다리지 않는다.
  it('만료된 토큰은 null 이다', async () => {
    const longAgo = new Date(Date.now() - (SESSION_MAX_AGE_SECONDS + 60) * 1000);
    const token = await signSession(user, SECRET, longAgo);
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  it('만료 직전 토큰은 아직 유효하다', async () => {
    const almost = new Date(Date.now() - (SESSION_MAX_AGE_SECONDS - 60) * 1000);
    const token = await signSession(user, SECRET, almost);
    expect(await verifySession(token, SECRET)).toEqual(user);
  });

  // 서명 알고리즘을 none 으로 바꿔서 서명 검사를 건너뛰게 하는 고전적인 공격.
  it('alg 가 none 인 토큰은 null 이다', async () => {
    const forged = new UnsecuredJWT({ sub: 'u1', nickname: '가짜', role: 'ADMIN' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .encode();
    expect(await verifySession(forged, SECRET)).toBeNull();
  });

  it.each([undefined, '', 'not.a.jwt', 'abc'])('토큰이 없거나 형식이 아니면 null 이다: %j', async (token) => {
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  it('role 이 MEMBER · ADMIN 이 아니면 null 이다', async () => {
    const token = await signSession({ ...user, role: 'SUPERUSER' as never }, SECRET);
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  // 토큰은 쿠키에 담겨 브라우저에 남는다. 이메일 같은 개인정보가 들어 있으면 안 된다.
  it('토큰에는 id · 닉네임 · 역할만 들어 있다', async () => {
    const claims = decodeJwt(await signSession(user, SECRET));
    expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'nickname', 'role', 'sub']);
  });

  it('비밀키가 너무 짧으면 서명을 거부한다', async () => {
    await expect(signSession(user, 'short')).rejects.toThrow();
  });
});
