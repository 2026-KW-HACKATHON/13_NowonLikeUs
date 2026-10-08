import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ queryRaw: vi.fn(), deleteMany: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { $queryRaw: db.queryRaw, rateLimitCounter: { deleteMany: db.deleteMany } } }));
import {
  clientIp, consumeRateLimit, counterQuery, counterRow, hashSubject, RATE_LIMITS, retryAfterSeconds, tooManyRequests,
} from '@/lib/rateLimit';

const req = (headers: Record<string, string>) => new Request('http://localhost/api/ask', { method: 'POST', headers });
const warn = vi.spyOn(console, 'warn');

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', 'x'.repeat(32));
  db.deleteMany.mockResolvedValue({ count: 0 });
  warn.mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe('counterRow', () => {
  it('같은 구간 안에서는 같은 키, 구간이 바뀌면 새 키이고 만료는 구간 끝이다', () => {
    const a = counterRow({ name: 'askTotal', subject: '*' }, 60_000 * 10 + 1);
    const b = counterRow({ name: 'askTotal', subject: '*' }, 60_000 * 11 - 1);
    const c = counterRow({ name: 'askTotal', subject: '*' }, 60_000 * 11);
    expect(a.key).toBe('askTotal:*:10');
    expect(b.key).toBe(a.key);
    expect(c.key).toBe('askTotal:*:11');
    expect(a.expiresAt.getTime()).toBe(60_000 * 11);
    expect(a.limit).toBe(RATE_LIMITS.askTotal.limit);
  });

  it('IP · 이메일은 원문 대신 HMAC 으로 키에 들어간다', () => {
    const row = counterRow({ name: 'loginPerEmail', subject: 'me@example.com' }, 0);
    expect(row.key).not.toContain('me@example.com');
    expect(row.key).toBe(`loginPerEmail:${hashSubject('me@example.com')}:0`);
    expect(hashSubject('me@example.com')).toMatch(/^[0-9a-f]{32}$/);
    expect(hashSubject('*')).toBe('*');
  });
});

describe('counterQuery', () => {
  it('카운터를 한 문장에서 원자적으로 올리고, 앞 카운터가 한도를 넘으면 뒤 카운터는 올리지 않는다', () => {
    const rows = [counterRow({ name: 'askPerIp', subject: '1.2.3.4' }, 0), counterRow({ name: 'askTotal', subject: '*' }, 0)];
    const query = counterQuery(rows);
    expect(query.text.match(/INSERT INTO "RateLimitCounter"/g)).toHaveLength(2);
    expect(query.text.match(/ON CONFLICT \("key"\) DO UPDATE SET "count" = "RateLimitCounter"\."count" \+ 1/g)).toHaveLength(2);
    expect(query.text).toMatch(/FROM b0 WHERE b0\."count" <= \$\d+::int/);
    expect(query.text).toContain('SELECT (SELECT "count" FROM b0) AS c0, (SELECT "count" FROM b1) AS c1');
    expect(query.values).toEqual([rows[0].key, rows[0].expiresAt, rows[1].key, rows[1].expiresAt, RATE_LIMITS.askPerIp.limit]);
  });
});

describe('retryAfterSeconds', () => {
  const rows = [counterRow({ name: 'askPerIp', subject: 'ip' }, 0), counterRow({ name: 'askTotal', subject: '*' }, 0)];
  it('한도까지는 0', () => {
    expect(retryAfterSeconds(rows, [30, 40], 0)).toBe(0);
  });
  it('한도를 넘은 카운터의 구간 끝까지 남은 초', () => {
    expect(retryAfterSeconds(rows, [30, 41], 15_000)).toBe(45);
    expect(retryAfterSeconds(rows, [31, null], 59_500)).toBe(1);
  });
});

describe('consumeRateLimit', () => {
  it('DB 를 한 번만 부르고 한도까지는 통과시킨다', async () => {
    db.queryRaw.mockResolvedValue([{ c0: 30, c1: 40 }]);
    const result = await consumeRateLimit([{ name: 'askPerIp', subject: 'ip' }, { name: 'askTotal', subject: '*' }], 0);
    expect(result).toBeNull();
    expect(db.queryRaw).toHaveBeenCalledTimes(1);
    expect(db.queryRaw.mock.calls[0][0].text).toContain('INSERT INTO "RateLimitCounter"');
  });

  it('한도를 넘으면 429 와 구간 끝까지의 Retry-After', async () => {
    db.queryRaw.mockResolvedValue([{ c0: 31, c1: null }]);
    const result = await consumeRateLimit([{ name: 'askPerIp', subject: 'ip' }, { name: 'askTotal', subject: '*' }], 20_000);
    expect(result?.status).toBe(429);
    expect(result?.headers.get('Retry-After')).toBe('40');
  });

  it('카운터 테이블이 없거나 DB 오류면 막지 않고 고정 문구만 남긴다', async () => {
    db.queryRaw.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('relation "RateLimitCounter" does not exist 1.2.3.4', { code: 'P2010', clientVersion: 'test' }));
    expect(await consumeRateLimit([{ name: 'loginPerIp', subject: '1.2.3.4' }])).toBeNull();
    expect(warn).toHaveBeenCalledWith('[rate-limit] 카운터를 쓰지 못해 제한 없이 통과: loginPerIp P2010');
  });

  it('버킷이 없으면 DB 를 부르지 않는다', async () => {
    expect(await consumeRateLimit([])).toBeNull();
    expect(db.queryRaw).not.toHaveBeenCalled();
  });

  it('가끔 다 쓴 카운터를 지우고, 지우다 실패해도 결과는 그대로다', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    db.queryRaw.mockResolvedValue([{ c0: 1 }]);
    db.deleteMany.mockRejectedValue(new Error('down'));
    expect(await consumeRateLimit([{ name: 'answerPerUser', subject: 'u1' }], 5000)).toBeNull();
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: new Date(5000) } } });
    random.mockRestore();
  });
});

describe('clientIp', () => {
  it('x-forwarded-for 의 첫 주소를 쓴다', () => {
    expect(clientIp(req({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' }))).toBe('203.0.113.7');
  });
  it('없으면 x-real-ip, 그것도 없으면 null', () => {
    expect(clientIp(req({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(clientIp(req({}))).toBeNull();
  });
});

describe('tooManyRequests', () => {
  it('429 와 정수 Retry-After, 고정 문구를 돌려준다', async () => {
    const response = tooManyRequests(12.2);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('13');
    expect(await response.json()).toEqual({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
  });
});
