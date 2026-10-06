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
const unrelatedTask: Task = {
  ...task,
  id: 'b',
  title: '음식물 쓰레기 버리기',
  why: '깨끗한 골목 유지',
  howTo: '전용 봉투 사용',
};
const oneRoomWasteTask: Task = {
  ...unrelatedTask,
  id: 'one-room-waste',
  title: '원룸 분리수거 안내',
  housingTypes: ['ONE_ROOM'],
};
const dormWasteTask: Task = {
  ...unrelatedTask,
  id: 'dorm-waste',
  title: '기숙사 분리수거 안내',
  housingTypes: ['DORM'],
};
const publicParkingTask: Task = {
  ...task,
  id: 'public-parking',
  title: '주차 관련 일반 안내',
};
const carOnlyTask: Task = {
  ...publicParkingTask,
  id: 'car-only',
  title: '차량 소유자 주차 신청',
  requiresCar: true,
};
const profile = { housingType: 'ONE_ROOM', contractType: 'MONTHLY', moveInDate: '2026-10-01', zone: '비공개 구역', hasCar: true, hasPet: true, isStudent: true };
const fetchMock = vi.fn<typeof fetch>();
const request = (body: unknown) => new Request('http://localhost/api/ask', { method: 'POST', body: JSON.stringify(body) });
const ai = (sourceIds = ['task:a'], confidence = 'GROUNDED') => Response.json({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ sourceIds, confidence }) }] } }],
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
    fetchMock.mockResolvedValueOnce(ai(['task:a', 'task:fake']));
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

  it('프로필에 맞지 않는 Task ID는 근거로 인정하지 않는다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    db.findMany.mockResolvedValueOnce([oneRoomWasteTask, dormWasteTask]);
    fetchMock.mockResolvedValueOnce(ai(['task:dorm-waste']));

    const response = await POST(request({ text: '분리수거 언제 해야 돼?', profile }));

    expect(await response.json()).toMatchObject({
      mode: 'AI', answer: null, confidence: 'UNKNOWN', tasks: [],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    const sent = JSON.parse(body.contents[0].parts[0].text);
    expect(sent.knowledge).toContain('task:one-room-waste | 원룸 분리수거 안내');
    expect(sent.knowledge).not.toContain('task:dorm-waste | 기숙사 분리수거 안내');
    expect(db.create.mock.calls[0][0].data).toMatchObject({
      aiAnswer: null, sourceIds: [], confidence: 'UNKNOWN',
    });
  });

  it('프로필에 맞는 후보가 없으면 활성화 상태에서도 Google을 호출하지 않는다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    db.findMany.mockResolvedValueOnce([dormWasteTask]);

    const response = await POST(request({ text: '분리수거', profile }));

    expect(await response.json()).toMatchObject({ mode: 'FALLBACK', tasks: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Gemini에는 키워드가 달라도 프로필에 맞는 전체 후보를 전달한다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    const rows = Array.from({ length: 4 }, (_, index): Task => ({
      ...task,
      id: String(index),
      title: index === 3 ? '종량제봉투 구매하기' : `생활 안내 ${index}`,
    }));
    db.findMany.mockResolvedValueOnce(rows);
    fetchMock.mockResolvedValueOnce(ai(['task:3']));

    const response = await POST(request({ text: '쓰레기봉투 어디서 사요?', profile }));

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    const sent = JSON.parse(body.contents[0].parts[0].text);
    expect(sent.knowledge.split('\n')).toEqual([
      'task:0 | 생활 안내 0 | 14일 이내 신고 | 주민센터 방문',
      'task:1 | 생활 안내 1 | 14일 이내 신고 | 주민센터 방문',
      'task:2 | 생활 안내 2 | 14일 이내 신고 | 주민센터 방문',
      'task:3 | 종량제봉투 구매하기 | 14일 이내 신고 | 주민센터 방문',
    ]);
    expect(await response.json()).toMatchObject({ mode: 'AI', tasks: [{ id: '3' }] });
  });

  it('AI를 쓰지 않을 때는 프로필에 맞는 할 일 안에서만 키워드 검색한다', async () => {
    db.findMany.mockResolvedValueOnce([oneRoomWasteTask, dormWasteTask]);

    const response = await POST(request({ text: '분리수거', profile }));

    expect(await response.json()).toMatchObject({
      mode: 'FALLBACK', tasks: [{ id: 'one-room-waste' }],
    });
  });

  it('차량·반려동물·학생 여부가 없으면 false로 보고 전용 할 일을 제외한다', async () => {
    db.findMany.mockResolvedValueOnce([publicParkingTask, carOnlyTask]);
    const legacyProfile = {
      housingType: profile.housingType,
      contractType: profile.contractType,
      moveInDate: profile.moveInDate,
    };

    const response = await POST(request({ text: '주차', profile: legacyProfile }));

    expect(await response.json()).toMatchObject({
      mode: 'FALLBACK', tasks: [{ id: 'public-parking' }],
    });
  });

  it('차량·반려동물·학생 여부가 true면 해당 전용 할 일을 포함한다', async () => {
    db.findMany.mockResolvedValueOnce([
      carOnlyTask,
      { ...publicParkingTask, id: 'pet-only', title: '반려동물 대상 주차 안내', requiresPet: true },
      { ...publicParkingTask, id: 'student-only', title: '학생 대상 주차 안내', studentOnly: true },
    ]);

    const response = await POST(request({ text: '주차', profile }));

    expect(await response.json()).toMatchObject({
      mode: 'FALLBACK',
      tasks: [{ id: 'car-only' }, { id: 'pet-only' }, { id: 'student-only' }],
    });
  });

  it('answer 없는 AI 선택 결과에도 서버의 고정 안내와 검증된 원문 카드만 저장·응답한다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    fetchMock.mockResolvedValueOnce(ai());
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

  it.each([{ ids: ['task:fake'] }, { ids: [] }])('근거가 없으면 서버 안내와 근거를 저장하지 않는다: %j', async ({ ids }) => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    fetchMock.mockResolvedValueOnce(ai(ids));
    expect(await (await POST(request({ text: '전입신고는?' }))).json()).toMatchObject({ mode: 'AI', answer: null, confidence: 'UNKNOWN', tasks: [] });
    expect(db.create.mock.calls[0][0].data.aiAnswer).toBeNull();
  });

  it('AI가 UNKNOWN이라고 판단하면 실제 근거가 있어도 답변을 저장하지 않는다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    fetchMock.mockResolvedValueOnce(ai(['task:a'], 'UNKNOWN'));
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
