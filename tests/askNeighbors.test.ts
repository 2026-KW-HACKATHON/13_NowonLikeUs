import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { question: { findUnique: db.findUnique, update: db.update } } }));
const session = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return { readJsonBody: actual.readJsonBody, getSessionUser: session.getSessionUser };
});
import { POST } from '@/app/api/questions/[id]/ask-neighbors/route';

const call = (id = 'q1', init: RequestInit = { headers: { 'Content-Type': 'application/json' }, body: '{}' }) =>
  POST(new Request(`http://localhost/api/questions/${id}/ask-neighbors`, { method: 'POST', ...init }), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  session.getSessionUser.mockResolvedValue(null);
  db.update.mockResolvedValue({ id: 'q1' });
});

describe('POST /api/questions/[id]/ask-neighbors', () => {
  it('비로그인으로 쓴 질문은 id 를 아는 질문자가 이웃에게 넘긴다', async () => {
    db.findUnique.mockResolvedValue({ askerId: null });
    const res = await call();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ questionId: 'q1' });
    expect(db.update).toHaveBeenCalledWith({ where: { id: 'q1' }, data: { askNeighbors: true }, select: { id: true } });
  });

  it('로그인해서 쓴 질문은 그 사람만 넘길 수 있다', async () => {
    db.findUnique.mockResolvedValue({ askerId: 'u1' });
    session.getSessionUser.mockResolvedValue({ id: 'u2', nickname: '남', role: 'MEMBER' });
    expect((await call()).status).toBe(403);

    session.getSessionUser.mockResolvedValue({ id: 'u1', nickname: '나', role: 'MEMBER' });
    expect((await call()).status).toBe(200);
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('없는 질문은 404', async () => {
    db.findUnique.mockResolvedValue(null);
    expect((await call('nope')).status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('JSON 이 아닌 요청은 막는다(다른 사이트의 폼 전송)', async () => {
    const res = await call('q1', { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'a=1' });
    expect(res.status).toBe(400);
    expect(db.findUnique).not.toHaveBeenCalled();
  });

  it('미디어 타입이 정확히 application/json 일 때만 받는다', async () => {
    const plain = await call('q1', { headers: { 'Content-Type': 'text/plain; application/json' }, body: '{}' });
    expect(plain.status).toBe(400);
    expect(db.findUnique).not.toHaveBeenCalled();

    db.findUnique.mockResolvedValue({ askerId: null });
    const charset = await call('q1', { headers: { 'Content-Type': 'Application/JSON; charset=utf-8' }, body: '{}' });
    expect(charset.status).toBe(200);
  });
});
