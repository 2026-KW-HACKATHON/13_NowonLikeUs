import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ updateMany: vi.fn(), findUnique: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { user: { updateMany: db.updateMany, findUnique: db.findUnique } } }));
const auth = vi.hoisted(() => ({ requireUser: vi.fn(), getSessionUser: vi.fn() }));
vi.mock('@/lib/auth', async (importOriginal) => ({
  readJsonBody: (await importOriginal<typeof import('@/lib/auth')>()).readJsonBody,
  requireUser: auth.requireUser,
  getSessionUser: auth.getSessionUser,
}));
import { DELETE, POST } from '@/app/api/me/neighborhood/route';
import { GET as getMe } from '@/app/api/auth/me/route';

const user = { id: 'user-1', nickname: '월계주민', role: 'MEMBER' };
const unauthorized = () => Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
const request = (body: string, contentType = 'application/json') =>
  new Request('http://localhost/api/me/neighborhood', { method: 'POST', headers: { 'Content-Type': contentType }, body });

const NOW = new Date('2026-10-10T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  auth.requireUser.mockResolvedValue(user);
  auth.getSessionUser.mockResolvedValue(user);
  db.updateMany.mockResolvedValue({ count: 1 });
});
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('POST /api/me/neighborhood', () => {
  it('지금 시각을 저장하고 그 시각을 돌려준다', async () => {
    const response = await POST(request('{}'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verifiedAt: NOW.toISOString() });
    expect(db.updateMany).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { neighborhoodVerifiedAt: NOW } });
  });

  // 좌표는 서버로 받지도 저장하지도 않는다는 약속. 본문에 실려 와도 저장 값에 섞이지 않는다.
  it('본문에 좌표가 와도 읽지 않고 시각만 저장한다', async () => {
    const response = await POST(request(JSON.stringify({ lat: 37.6196, lng: 127.0586, accuracy: 10 })));
    expect(response.status).toBe(200);
    const saved = db.updateMany.mock.calls[0][0];
    expect(saved.data).toEqual({ neighborhoodVerifiedAt: NOW });
    expect(JSON.stringify(saved)).not.toMatch(/37\.6196|127\.0586|lat|lng/);
  });

  it('로그인하지 않았으면 401, 저장하지 않는다', async () => {
    auth.requireUser.mockResolvedValueOnce(unauthorized());
    expect((await POST(request('{}'))).status).toBe(401);
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it('JSON 이 아니거나 깨졌으면 400, 저장하지 않는다', async () => {
    expect((await POST(request('{}', 'text/plain'))).status).toBe(400);
    expect((await POST(request('{', 'application/json'))).status).toBe(400);
    expect(db.updateMany).not.toHaveBeenCalled();
  });

  it('확인과 저장 사이에 계정이 지워졌으면 401', async () => {
    db.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await POST(request('{}'))).status).toBe(401);
  });
});

describe('DELETE /api/me/neighborhood', () => {
  it('인증을 지우고 null 을 돌려준다', async () => {
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verifiedAt: null });
    expect(db.updateMany).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { neighborhoodVerifiedAt: null } });
  });

  it('로그인하지 않았으면 401, 저장하지 않는다', async () => {
    auth.requireUser.mockResolvedValueOnce(unauthorized());
    expect((await DELETE()).status).toBe(401);
    expect(db.updateMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/auth/me — neighborhoodVerified', () => {
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

  it('로그인하지 않았으면 false, DB 를 읽지 않는다', async () => {
    auth.getSessionUser.mockResolvedValueOnce(null);
    expect(await (await getMe()).json()).toEqual({ user: null, neighborhoodVerified: false });
    expect(db.findUnique).not.toHaveBeenCalled();
  });

  it('180일 안에 인증했으면 true, 날짜는 내려주지 않는다', async () => {
    db.findUnique.mockResolvedValueOnce({ neighborhoodVerifiedAt: daysAgo(179) });
    const body = await (await getMe()).json();
    expect(body).toEqual({ user, neighborhoodVerified: true });
  });

  it('180일이 지났거나 인증하지 않았으면 false', async () => {
    db.findUnique.mockResolvedValueOnce({ neighborhoodVerifiedAt: daysAgo(180) });
    expect((await (await getMe()).json()).neighborhoodVerified).toBe(false);
    db.findUnique.mockResolvedValueOnce({ neighborhoodVerifiedAt: null });
    expect((await (await getMe()).json()).neighborhoodVerified).toBe(false);
  });

  it('계정이 없으면 false', async () => {
    db.findUnique.mockResolvedValueOnce(null);
    expect((await (await getMe()).json()).neighborhoodVerified).toBe(false);
  });
});
