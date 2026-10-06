import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { askGemini } from '@/lib/gemini';

const selection = { sourceIds: ['task:a'], confidence: 'GROUNDED' };
const fetchMock = vi.fn<typeof fetch>();
const call = () => askGemini('전입신고는?', 'task:a | 전입신고 | 안내 | 신청', '월세');
const response = (value: unknown = selection, finishReason = 'STOP') => Response.json({
  candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(value) }] }, finishReason }],
});

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubEnv('GEMINI_MODEL', '');
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('askGemini', () => {
  it('answer 없이 구조화된 근거 선택 결과를 반환한다', async () => {
    fetchMock.mockResolvedValueOnce(response());
    expect(await call()).toEqual(selection);
  });

  it('구조화된 요청을 보내고 올바른 응답을 반환한다', async () => {
    fetchMock.mockResolvedValueOnce(response());
    expect(await call()).toEqual(selection);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
    expect(options?.method).toBe('POST');
    expect(new Headers(options?.headers).get('x-goog-api-key')).toBe('test-key');
    const body = JSON.parse(options?.body as string);
    expect(body.generationConfig).toMatchObject({ temperature: 0, responseMimeType: 'application/json' });
    expect(body.generationConfig.responseSchema.required).toEqual(['sourceIds', 'confidence']);
    expect(body.generationConfig.responseSchema.properties).not.toHaveProperty('answer');
    expect(body.contents[0].parts[0].text).toContain('전입신고는?');
    expect(body.contents[0].parts[0].text).toContain('task:a | 전입신고');
    expect(body.contents[0].parts[0].text).toContain('월세');
    expect(body.systemInstruction.parts[0].text).toContain('UNKNOWN');
    expect(body.systemInstruction.parts[0].text).not.toContain('answer');
  });

  it('환경 변수의 모델을 사용한다', async () => {
    vi.stubEnv('GEMINI_MODEL', 'custom-model');
    fetchMock.mockResolvedValueOnce(response());
    await call();
    expect(fetchMock.mock.calls[0][0]).toContain('/models/custom-model:generateContent');
  });

  it.each(['', '   '])('키가 비어 있으면 외부 요청 없이 null이다: %j', async (key) => {
    vi.stubEnv('GEMINI_API_KEY', key);
    expect(await call()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 429, 500])('HTTP %s 오류는 null이다', async (status) => {
    fetchMock.mockResolvedValueOnce(new Response('', { status }));
    expect(await call()).toBeNull();
  });

  it('네트워크 예외는 밖으로 던지지 않는다', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network failure'));
    expect(await call()).toBeNull();
  });

  it.each([null, {}, { candidates: [] }, { candidates: [{ content: { parts: [] } }] }])(
    '응답 내용이 없으면 null이다: %j', async (body) => {
      fetchMock.mockResolvedValueOnce(Response.json(body));
      expect(await call()).toBeNull();
    },
  );

  it('HTTP 본문이 JSON이 아니면 null이다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('invalid json'));
    expect(await call()).toBeNull();
  });

  it('생성 텍스트가 JSON이 아니면 null이다', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] }));
    expect(await call()).toBeNull();
  });

  it.each([
    null, [], {}, { confidence: 'GROUNDED' }, { sourceIds: ['task:a'] },
    { ...selection, sourceIds: 'task:a' }, { ...selection, sourceIds: [1] },
    { ...selection, confidence: 'CERTAIN' },
  ])('생성 데이터의 형식이 잘못되면 null이다: %j', async (value) => {
    fetchMock.mockResolvedValueOnce(response(value));
    expect(await call()).toBeNull();
  });

  it.each(['MAX_TOKENS', 'SAFETY'])('정상 종료가 아닌 %s 응답은 사용하지 않는다', async (reason) => {
    fetchMock.mockResolvedValueOnce(response(selection, reason));
    expect(await call()).toBeNull();
  });

  it.each(['PARTIAL', 'UNKNOWN'])('%s 판정은 후속 근거 검증 단계에 그대로 전달한다', async (confidence) => {
    fetchMock.mockResolvedValueOnce(response({ sourceIds: [], confidence }));
    expect(await call()).toEqual({ sourceIds: [], confidence });
  });

  it('15초가 지나면 실제 요청 신호를 중단하고 null을 반환한다', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      signal = options?.signal ?? undefined;
      signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    const pending = call();
    await vi.advanceTimersByTimeAsync(14999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBeNull();
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('헤더 수신 후 본문을 기다리는 시간에도 제한이 적용된다', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(async (_url, options) => new Response(new ReadableStream({
      start(controller) {
        options?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true });
      },
    })));
    const pending = call();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('정상 응답 후에는 시간 제한 타이머를 정리한다', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(response());
    expect(await call()).toEqual(selection);
    expect(vi.getTimerCount()).toBe(0);
  });
});
