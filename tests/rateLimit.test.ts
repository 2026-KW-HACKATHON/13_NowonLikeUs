import { describe, expect, it } from 'vitest';
import { clientIp, createLimiter, limitByIp, tooManyRequests, windowStart } from '@/lib/rateLimit';

const req = (headers: Record<string, string>) => new Request('http://localhost/api/ask', { method: 'POST', headers });

describe('createLimiter', () => {
  it('창 안에서 limit 번까지 허용하고 그다음은 남은 초를 돌려준다', () => {
    const limiter = createLimiter({ limit: 3, windowMs: 60_000 });
    expect([0, 1000, 2000].map((t) => limiter.hit('ip', t))).toEqual([0, 0, 0]);
    // 첫 요청(0초)이 창에서 빠지는 60초까지 30초 남았다.
    expect(limiter.hit('ip', 30_000)).toBe(30);
  });

  it('막힌 요청은 세지 않아, 가장 오래된 요청이 창을 벗어나면 다시 허용한다', () => {
    const limiter = createLimiter({ limit: 2, windowMs: 10_000 });
    limiter.hit('ip', 0);
    limiter.hit('ip', 5000);
    expect(limiter.hit('ip', 9000)).toBeGreaterThan(0);
    expect(limiter.hit('ip', 10_001)).toBe(0);
    expect(limiter.hit('ip', 10_002)).toBeGreaterThan(0);
  });

  it('키마다 따로 센다', () => {
    const limiter = createLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.hit('a', 0)).toBe(0);
    expect(limiter.hit('b', 0)).toBe(0);
    expect(limiter.hit('a', 1)).toBeGreaterThan(0);
  });

  it('남은 시간이 1초 미만이어도 1초로 올려 준다', () => {
    const limiter = createLimiter({ limit: 1, windowMs: 1000 });
    limiter.hit('ip', 0);
    expect(limiter.hit('ip', 999)).toBe(1);
  });

  it('키 수가 상한을 넘으면 가장 오래 안 쓴 키부터 버린다', () => {
    const limiter = createLimiter({ limit: 1, windowMs: 60_000 }, 2);
    limiter.hit('a', 0);
    limiter.hit('b', 1);
    limiter.hit('c', 2); // a 가 버려진다
    expect(limiter.hit('a', 3)).toBe(0);
    expect(limiter.hit('c', 4)).toBeGreaterThan(0);
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

describe('limitByIp', () => {
  it('IP 를 모르면 메모리 제한을 건너뛴다', () => {
    const limiter = createLimiter({ limit: 1, windowMs: 60_000 });
    expect(limitByIp(limiter, req({}))).toBeNull();
    expect(limitByIp(limiter, req({}))).toBeNull();
  });
  it('한도를 넘으면 429 응답을 돌려준다', () => {
    const limiter = createLimiter({ limit: 1, windowMs: 60_000 });
    expect(limitByIp(limiter, req({ 'x-real-ip': '1.2.3.4' }))).toBeNull();
    expect(limitByIp(limiter, req({ 'x-real-ip': '1.2.3.4' }))?.status).toBe(429);
  });
});

describe('tooManyRequests · windowStart', () => {
  it('429 와 정수 Retry-After, 고정 문구를 돌려준다', async () => {
    const response = tooManyRequests(12.2);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('13');
    expect(await response.json()).toEqual({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
  });
  it('창의 시작 시각은 now - windowMs', () => {
    expect(windowStart({ limit: 1, windowMs: 60_000 }, 100_000).getTime()).toBe(40_000);
  });
});
