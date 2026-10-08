import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * 가입 · 로그인 · 답변 작성 라우트의 요청 횟수 제한. 카운터 SQL 은 rateLimit.test.ts 에서 보고,
 * 여기서는 라우트가 어떤 카운터를 어떤 순서로 세는지, 한도 직전은 통과하고 넘으면 429 인지,
 * 그리고 429 일 때 비밀번호 해시 · 저장 · 세션 발급까지 가지 않는지를 본다.
 */

vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({
  queryRaw: vi.fn(), createUser: vi.fn(), findUser: vi.fn(), findQuestion: vi.fn(),
  createAnswer: vi.fn(), updateQuestions: vi.fn(), transaction: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: db.queryRaw,
    $transaction: db.transaction,
    rateLimitCounter: { deleteMany: () => Promise.resolve({ count: 0 }) },
    user: { create: db.createUser, findUnique: db.findUser },
    question: { findUnique: db.findQuestion, updateMany: db.updateQuestions },
    answer: { create: db.createAnswer },
  },
}));
const auth = vi.hoisted(() => ({ setSessionCookie: vi.fn(), requireUser: vi.fn() }));
vi.mock('@/lib/auth', async (importOriginal) => ({
  readJsonBody: (await importOriginal<typeof import('@/lib/auth')>()).readJsonBody,
  setSessionCookie: auth.setSessionCookie,
  requireUser: auth.requireUser,
}));
const password = vi.hoisted(() => ({ hashPassword: vi.fn(), verifyPassword: vi.fn() }));
vi.mock('@/lib/password', () => password);

import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as answer } from '@/app/api/questions/[id]/answers/route';

const IP = '203.0.113.7';
const post = (url: string, body: unknown) => new Request(`http://localhost${url}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': IP }, body: JSON.stringify(body),
});
/** 이번 요청이 올린 카운터 키들(이름 부분만). */
const counted = () => (db.queryRaw.mock.calls[0][0].values as unknown[])
  .filter((v): v is string => typeof v === 'string')
  .map((key) => key.split(':')[0]);

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', 'x'.repeat(32));
  password.hashPassword.mockResolvedValue('hashed');
  password.verifyPassword.mockResolvedValue(true);
  db.createUser.mockResolvedValue({ id: 'u1', nickname: '주민', role: 'MEMBER' });
  db.findUser.mockResolvedValue({ id: 'u1', nickname: '주민', role: 'MEMBER', passwordHash: 'hashed' });
  auth.requireUser.mockResolvedValue({ id: 'u1', nickname: '주민', role: 'MEMBER' });
  db.findQuestion.mockResolvedValue({ status: 'OPEN' });
  db.transaction.mockResolvedValue([{
    id: 'a1', text: '답', createdAt: new Date(), verifiedAt: new Date(), author: { nickname: '주민' },
    _count: { confirmations: 0 }, confirmations: [],
  }]);
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe('POST /api/auth/signup 요청 횟수 제한', () => {
  const body = { email: 'new@example.com', password: 'password1', nickname: '새주민' };

  it('IP별 → 전체 순서로 세고, 전체 한도 직전(100번째)은 가입된다', async () => {
    db.queryRaw.mockResolvedValue([{ c0: 60, c1: 100 }]);
    expect((await signup(post('/api/auth/signup', body))).status).toBe(201);
    expect(counted()).toEqual(['signupPerIp', 'signupTotal']);
  });

  it('전체 한도를 넘으면 429 이고 해시 · 저장 · 세션 발급을 하지 않는다', async () => {
    db.queryRaw.mockResolvedValue([{ c0: 1, c1: 101 }]);
    const response = await signup(post('/api/auth/signup', body));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).not.toBeNull();
    expect(password.hashPassword).not.toHaveBeenCalled();
    expect(db.createUser).not.toHaveBeenCalled();
    expect(auth.setSessionCookie).not.toHaveBeenCalled();
  });

  it('IP 한도(10분 60회)를 넘으면 429 다', async () => {
    db.queryRaw.mockResolvedValue([{ c0: 61, c1: null }]);
    expect((await signup(post('/api/auth/signup', body))).status).toBe(429);
  });

  it('형식이 틀린 요청은 카운터를 올리지 않는다', async () => {
    expect((await signup(post('/api/auth/signup', { ...body, password: 'short' }))).status).toBe(400);
    expect(db.queryRaw).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/login 요청 횟수 제한', () => {
  const body = { email: 'Me@Example.com', password: 'password1' };

  it('IP별 → 이메일별 순서로 세고, 이메일 한도 직전(10번째)은 로그인된다', async () => {
    db.queryRaw.mockResolvedValue([{ c0: 100, c1: 10 }]);
    expect((await login(post('/api/auth/login', body))).status).toBe(200);
    expect(counted()).toEqual(['loginPerIp', 'loginPerEmail']);
  });

  it('대소문자가 달라도 같은 이메일 카운터를 쓴다', async () => {
    db.queryRaw.mockResolvedValue([{ c0: 1, c1: 1 }]);
    await login(post('/api/auth/login', body));
    await login(post('/api/auth/login', { ...body, email: 'me@example.com' }));
    const [first, second] = db.queryRaw.mock.calls.map(([query]) => query.values[2]);
    expect(first).toBe(second);
  });

  it('이메일 한도를 넘으면 429 이고 비밀번호를 비교하지 않는다', async () => {
    db.queryRaw.mockResolvedValue([{ c0: 1, c1: 11 }]);
    const response = await login(post('/api/auth/login', body));
    expect(response.status).toBe(429);
    expect(password.verifyPassword).not.toHaveBeenCalled();
    expect(auth.setSessionCookie).not.toHaveBeenCalled();
  });
});

describe('POST /api/questions/[id]/answers 요청 횟수 제한', () => {
  const params = { params: Promise.resolve({ id: 'q1' }) };

  it('계정별로 세고, 한도 직전(5번째)은 답변이 저장된다', async () => {
    db.queryRaw.mockResolvedValue([{ c0: 5 }]);
    expect((await answer(post('/api/questions/q1/answers', { text: '주민센터 2층이에요' }), params)).status).toBe(201);
    expect(counted()).toEqual(['answerPerUser']);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it('한도를 넘으면 429 이고 저장하지 않는다', async () => {
    db.queryRaw.mockResolvedValue([{ c0: 6 }]);
    const response = await answer(post('/api/questions/q1/answers', { text: '주민센터 2층이에요' }), params);
    expect(response.status).toBe(429);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('로그인하지 않았으면 카운터를 올리기 전에 401 이다', async () => {
    auth.requireUser.mockResolvedValue(Response.json({ error: '로그인이 필요합니다.' }, { status: 401 }));
    expect((await answer(post('/api/questions/q1/answers', { text: '답' }), params)).status).toBe(401);
    expect(db.queryRaw).not.toHaveBeenCalled();
  });
});
