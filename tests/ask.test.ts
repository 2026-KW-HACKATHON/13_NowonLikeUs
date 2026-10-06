import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '@prisma/client';

vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ findMany: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { task: { findMany: db.findMany }, question: { create: db.create } } }));
import { POST } from '@/app/api/ask/route';

const task: Task = {
  id: 'a', title: '전입신고 하기', why: '14일 이내 신고', howTo: '주민센터 방문',
  dueOffsetDays: 14, linkUrl: null, placeName: null, placeAddress: null, placePhone: null,
  category: 'ADMIN', housingTypes: [], contractTypes: [], requiresCar: false, requiresPet: false,
  studentOnly: false, source: 'SEED', promotedFromQuestionId: null, sourceNote: '검증된 출처',
  verifiedAt: new Date('2026-10-01'), isPublished: true, createdAt: new Date(), updatedAt: new Date(),
};
const profile = { housingType: 'ONE_ROOM', contractType: 'MONTHLY', moveInDate: '2026-10-01', zone: '비공개 구역', hasCar: true, hasPet: true, isStudent: true };
const fetchMock = vi.fn<typeof fetch>();
const request = (body: unknown) => new Request('http://localhost/api/ask', { method: 'POST', body: JSON.stringify(body) });
const ai = (answer = '관련 항목을 확인해 주세요.', sourceIds = ['task:a'], confidence = 'GROUNDED') => Response.json({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ answer, sourceIds, confidence }) }] } }],
});

beforeEach(() => {
  vi.stubEnv('GEMINI_ALLOW_USER_INPUT', '');
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubGlobal('fetch', fetchMock);
  db.findMany.mockResolvedValue([task]);
  db.create.mockResolvedValue({ id: 'q-test' });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe('POST /api/ask', () => {
  it.each(['', 'false', 'TRUE'])('기본값/명시적 true 이외에는 외부 전송 없이 폴백한다: %j', async (setting) => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', setting);
    const response = await POST(request({ text: '전입신고는?', profile }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: 'FALLBACK', answer: null, confidence: 'UNKNOWN', questionId: 'q-test', tasks: [{ id: 'a', why: '14일 이내 신고' }] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.findMany).toHaveBeenCalledWith({ where: { isPublished: true } });
    expect(db.create.mock.calls[0][0].data).toEqual({ text: '전입신고는?', aiAnswer: null, sourceIds: [], confidence: 'UNKNOWN', ctxHousingType: 'ONE_ROOM', ctxContractType: 'MONTHLY' });
  });

  it('허용 시에도 Google에 주거형태와 계약형태만 전달하고 검증된 근거만 저장한다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    fetchMock.mockResolvedValueOnce(ai('모델이 만든 임의의 안내입니다.', ['task:a', 'task:fake']));
    const response = await POST(request({ text: '전입신고는?', profile }));
    expect(await response.json()).toMatchObject({
      mode: 'AI',
      answer: '관련 항목의 원문 카드를 확인해 주세요.',
      confidence: 'PARTIAL',
      tasks: [{ id: 'a' }],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    const sent = JSON.parse(body.contents[0].parts[0].text);
    expect(sent.profileLine).toBe('주거형태: 원룸, 계약형태: 월세');
    expect(JSON.stringify(sent)).not.toContain('2026-10-01');
    expect(JSON.stringify(sent)).not.toContain('비공개 구역');
    expect(sent.profileLine).not.toMatch(/hasCar|hasPet|isStudent/);
    expect(db.create.mock.calls[0][0].data).toMatchObject({ sourceIds: ['task:a'], confidence: 'PARTIAL', aiAnswer: '관련 항목의 원문 카드를 확인해 주세요.' });
  });

  it.each([
    '14일 안에 신고하세요.',
    '방 번호: 이사일',
    '이번 주소 변경은 관련 문서를 확인하세요.',
  ])('AI 문구 대신 서버의 고정 안내와 검증된 원문 카드만 저장·응답한다: %s', async (answer) => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    fetchMock.mockResolvedValueOnce(ai(answer));
    const response = await POST(request({ text: '전입신고는?' }));
    expect(await response.json()).toMatchObject({
      mode: 'AI',
      answer: '관련 항목의 원문 카드를 확인해 주세요.',
      confidence: 'GROUNDED',
      tasks: [{ id: 'a', daysLeft: null }],
    });
    expect(db.create.mock.calls[0][0].data).toMatchObject({
      aiAnswer: '관련 항목의 원문 카드를 확인해 주세요.',
      sourceIds: ['task:a'],
      confidence: 'GROUNDED',
    });
  });

  it.each([{ ids: ['task:fake'] }, { ids: [] }])('근거가 없으면 AI 문장과 근거를 저장하지 않는다: %j', async ({ ids }) => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    fetchMock.mockResolvedValueOnce(ai('관련 항목을 확인해 주세요.', ids));
    expect(await (await POST(request({ text: '전입신고는?' }))).json()).toMatchObject({ mode: 'AI', answer: null, confidence: 'UNKNOWN', tasks: [] });
    expect(db.create.mock.calls[0][0].data.aiAnswer).toBeNull();
  });

  it('AI가 UNKNOWN이라고 판단하면 실제 근거가 있어도 답변을 저장하지 않는다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    fetchMock.mockResolvedValueOnce(ai('아직 확인되지 않은 내용입니다.', ['task:a'], 'UNKNOWN'));
    const response = await POST(request({ text: '전입신고' }));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ mode: 'AI', answer: null, confidence: 'UNKNOWN', tasks: [] });
    expect(db.create.mock.calls[0][0].data).toMatchObject({ aiAnswer: null, sourceIds: [] });
  });

  it('공개 지식이 없으면 활성화 상태에서도 Google로 보내지 않는다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    db.findMany.mockResolvedValueOnce([]);
    expect(await (await POST(request({ text: '질문' }))).json()).toMatchObject({ mode: 'FALLBACK', tasks: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('키가 없으면 활성화 상태에서도 폴백한다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(await (await POST(request({ text: '전입신고' }))).json()).toMatchObject({ mode: 'FALLBACK', tasks: [{ id: 'a' }] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('DB 조회 실패는 외부 전송이나 저장 없이 503이다', async () => {
    db.findMany.mockRejectedValueOnce(new Error('database unavailable'));
    expect((await POST(request({ text: '전입신고' }))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.create).not.toHaveBeenCalled();
  });

  it('Gemini HTTP 오류도 정상 폴백 응답이다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    expect(await (await POST(request({ text: '전입신고' }))).json()).toMatchObject({ mode: 'FALLBACK', answer: null });
  });

  it.each([null, [], {}, { text: 1 }, { text: '  ' }, { text: '가'.repeat(1001) }, { text: '질문', profile: null }, { text: '질문', profile: { ...profile, housingType: '임의 지시' } }, { text: '질문', profile: { ...profile, moveInDate: '2026-02-30' } }])('잘못된 입력은 DB·Google 접근 전에 거절한다: %j', async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(db.findMany).not.toHaveBeenCalled();
    expect(db.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('깨진 JSON은 400이다', async () => {
    expect((await POST(new Request('http://localhost/api/ask', { method: 'POST', body: '{' }))).status).toBe(400);
  });

  it('DB 실패 시 성공한 것처럼 응답하거나 내부 오류를 노출하지 않는다', async () => {
    db.create.mockRejectedValueOnce(new Error('private database connection'));
    const response = await POST(request({ text: '전입신고' }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private');
  });
});
