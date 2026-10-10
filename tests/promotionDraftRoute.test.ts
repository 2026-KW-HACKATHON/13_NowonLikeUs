import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ findQuestion: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { question: { findUnique: db.findQuestion } } }));
const auth = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/auth', async (importOriginal) => ({
  readJsonBody: (await importOriginal<typeof import('@/lib/auth')>()).readJsonBody,
  requireAdmin: auth.requireAdmin,
}));
import { POST } from '@/app/api/admin/promote/draft/route';

const fetchMock = vi.fn<typeof fetch>();
const warn = vi.spyOn(console, 'warn');
const request = (body: unknown) => new Request('http://localhost/api/admin/promote/draft', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const question = {
  text: '음식물쓰레기 어디에 버려요?',
  status: 'ANSWERED',
  ctxHousingType: 'ONE_ROOM',
  ctxContractType: 'MONTHLY',
  answers: [{ text: '전용 수거용기에 담아 집 앞에 내놓으면 돼요.' }],
};
const generated = {
  title: '음식물쓰레기 버리는 방법 알아두기',
  why: '아무 데나 버리면 수거되지 않습니다.',
  howTo: '전용 수거용기에 담아 집 앞에 내놓습니다.',
  category: 'WASTE',
  dueOffsetDays: null,
  linkUrl: null,
  placeName: null,
  placeAddress: null,
  placePhone: null,
  housingTypes: ['ONE_ROOM'],
  contractTypes: [],
};
const ai = (value: unknown) => Response.json({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }],
});

beforeEach(() => {
  vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubGlobal('fetch', fetchMock);
  auth.requireAdmin.mockResolvedValue({ id: 'admin', role: 'ADMIN' });
  db.findQuestion.mockResolvedValue(question);
  warn.mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe('POST /api/admin/promote/draft', () => {
  it('운영자가 아니면 그대로 막는다', async () => {
    auth.requireAdmin.mockResolvedValueOnce(Response.json({ error: '운영자만 할 수 있습니다.' }, { status: 403 }));
    expect((await POST(request({ questionId: 'q1' }))).status).toBe(403);
    expect(db.findQuestion).not.toHaveBeenCalled();
  });

  it('questionId 가 없으면 400', async () => {
    expect((await POST(request({}))).status).toBe(400);
  });

  it('없는 질문은 404, 답변 없는 질문은 409', async () => {
    db.findQuestion.mockResolvedValueOnce(null);
    expect((await POST(request({ questionId: 'q1' }))).status).toBe(404);
    db.findQuestion.mockResolvedValueOnce({ ...question, status: 'OPEN', answers: [] });
    expect((await POST(request({ questionId: 'q1' }))).status).toBe(409);
  });

  it.each(['', 'false'])('스위치가 꺼져 있으면 외부 요청 없이 draft: null: %j', async (setting) => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', setting);
    const response = await POST(request({ questionId: 'q1' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ draft: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('질문 · 답변 내용만 보내고 검증한 초안을 돌려준다', async () => {
    fetchMock.mockResolvedValueOnce(ai(generated));
    const response = await POST(request({ questionId: 'q1' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      draft: { ...generated, requiresCar: false, requiresPet: false, studentOnly: false },
    });
    const sent = JSON.parse(fetchMock.mock.calls[0][1]?.body as string).contents[0].parts[0].text;
    expect(JSON.parse(sent)).toEqual({
      question: question.text,
      answers: [question.answers[0].text],
      askerHousingType: 'ONE_ROOM',
      askerContractType: 'MONTHLY',
    });
  });

  it('AI 호출이 실패하면 draft: null 로 빈 양식에 넘긴다', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    expect(await (await POST(request({ questionId: 'q1' }))).json()).toEqual({ draft: null });
  });

  it('AI 응답 형식이 틀리면 draft: null', async () => {
    fetchMock.mockResolvedValueOnce(ai({ title: '분류 없음' }));
    expect(await (await POST(request({ questionId: 'q1' }))).json()).toEqual({ draft: null });
    expect(warn).toHaveBeenCalledWith('[gemini] 호출 실패: draft-schema');
  });
});
