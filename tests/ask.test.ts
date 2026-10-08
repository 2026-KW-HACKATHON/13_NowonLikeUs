import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, type Task } from '@prisma/client';

vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ findMany: vi.fn(), create: vi.fn(), findUser: vi.fn(), queryRaw: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: {
  task: { findMany: db.findMany }, question: { create: db.create }, user: { findUnique: db.findUser },
  $queryRaw: db.queryRaw, rateLimitCounter: { deleteMany: () => Promise.resolve({ count: 0 }) },
} }));
const session = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/auth', async (importOriginal) => ({
  readJsonBody: (await importOriginal<typeof import('@/lib/auth')>()).readJsonBody,
  getSessionUser: session.getSessionUser,
}));
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
const rawRequest = (body: string, contentType = 'application/json') => new Request('http://localhost/api/ask', {
  method: 'POST', headers: { 'Content-Type': contentType }, body,
});
const request = (body: unknown) => rawRequest(JSON.stringify(body));
const warn = vi.spyOn(console, 'warn');
const ai = (sourceIds = ['task:a'], confidence = 'GROUNDED') => Response.json({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ sourceIds, confidence }) }] } }],
});

beforeEach(() => {
  vi.stubEnv('GEMINI_ALLOW_USER_INPUT', '');
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubGlobal('fetch', fetchMock);
  db.findMany.mockResolvedValue([task]);
  db.create.mockResolvedValue({ id: 'q-test' });
  db.queryRaw.mockResolvedValue([{ c0: 1, c1: 1 }]);
  session.getSessionUser.mockResolvedValue(null);
  db.findUser.mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve({ id: where.id }));
  warn.mockImplementation(() => {});
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
    expect(db.create.mock.calls[0][0].data).toEqual({ text: '전입신고는?', aiAnswer: null, sourceIds: [], confidence: 'UNKNOWN', ctxHousingType: 'ONE_ROOM', ctxContractType: 'MONTHLY', askerId: null });
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

  it('Gemini가 task: 접두어를 뺀 실제 ID를 돌려줘도 근거와 카드를 인정한다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    fetchMock.mockResolvedValueOnce(ai(['a']));

    const response = await POST(request({ text: '전입신고 언제까지 해요?', profile }));

    expect(await response.json()).toMatchObject({
      mode: 'AI',
      answer: '관련 항목의 원문 카드를 확인해 주세요.',
      confidence: 'GROUNDED',
      tasks: [{ id: 'a' }],
    });
    expect(db.create.mock.calls[0][0].data).toMatchObject({
      sourceIds: ['task:a'],
      confidence: 'GROUNDED',
    });
  });

  it('프로필에 맞지 않는 Task ID는 근거로 인정하지 않는다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    db.findMany.mockResolvedValueOnce([oneRoomWasteTask, dormWasteTask]);
    fetchMock.mockResolvedValueOnce(ai(['task:dorm-waste']));

    const response = await POST(request({ text: '분리수거 언제 해야 돼?', profile }));

    expect(await response.json()).toMatchObject({
      mode: 'FALLBACK', answer: null, confidence: 'UNKNOWN', tasks: [{ id: 'one-room-waste' }],
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

  it.each([{ ids: ['task:fake'] }, { ids: [] }])('근거가 없으면 키워드 검색으로 넘어가고 서버 안내와 근거를 저장하지 않는다: %j', async ({ ids }) => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    fetchMock.mockResolvedValueOnce(ai(ids));
    expect(await (await POST(request({ text: '전입신고는?' }))).json()).toMatchObject({ mode: 'FALLBACK', answer: null, confidence: 'UNKNOWN', tasks: [{ id: 'a' }] });
    expect(db.create.mock.calls[0][0].data).toMatchObject({ aiAnswer: null, sourceIds: [], confidence: 'UNKNOWN' });
  });

  it('AI가 UNKNOWN이라고 판단하면 실제 근거가 있어도 답변을 저장하지 않는다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    fetchMock.mockResolvedValueOnce(ai(['task:a'], 'UNKNOWN'));
    const response = await POST(request({ text: '전입신고' }));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ mode: 'FALLBACK', answer: null, confidence: 'UNKNOWN', tasks: [{ id: 'a' }] });
    expect(db.create.mock.calls[0][0].data).toMatchObject({ aiAnswer: null, sourceIds: [], confidence: 'UNKNOWN' });
  });

  it('AI가 고른 순서대로 최대 3개만 보여주고, 보여준 카드만 근거로 저장한다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    const tasks = ['t1', 't2', 't3', 't4'].map((id) => ({ ...task, id }));
    db.findMany.mockResolvedValueOnce(tasks);
    fetchMock.mockResolvedValueOnce(ai(['task:t4', 'task:t2', 'task:t1', 'task:t3']));

    const response = await POST(request({ text: '전입신고' }));

    expect((await response.json()).tasks.map((t: { id: string }) => t.id)).toEqual(['t4', 't2', 't1']);
    expect(db.create.mock.calls[0][0].data).toMatchObject({ sourceIds: ['task:t4', 'task:t2', 'task:t1'], confidence: 'GROUNDED' });
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

  it.each([
    ['깨진 JSON', '{', 'application/json'],
    ['JSON이 아닌 Content-Type', JSON.stringify({ text: '전입신고' }), 'text/plain'],
    ['JSON과 비슷한 Content-Type', JSON.stringify({ text: '전입신고' }), 'application/jsonp'],
    ['매개변수에만 JSON이 있는 Content-Type', JSON.stringify({ text: '전입신고' }), 'text/plain; note=application/json'],
  ])('%s은 기존과 같은 400 응답이고 DB에 접근하지 않는다', async (_label, body, contentType) => {
    const response = await POST(rawRequest(body, contentType));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '질문을 1~1000자로 입력해 주세요.' });
    expect(db.findMany).not.toHaveBeenCalled();
  });

  it.each(['application/json; charset=utf-8', 'Application/JSON'])('JSON Content-Type은 매개변수·대소문자와 관계없이 받는다: %s', async (contentType) => {
    expect((await POST(rawRequest(JSON.stringify({ text: '전입신고' }), contentType))).status).toBe(200);
  });

  it('DB 실패 시 성공한 것처럼 응답하거나 내부 오류를 노출하지 않는다', async () => {
    db.create.mockRejectedValueOnce(new Error('private database connection'));
    const response = await POST(request({ text: '전입신고' }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private');
  });

  it.each([
    ['Prisma 요청 오류', () => new Prisma.PrismaClientKnownRequestError('private database connection', { code: 'P2002', clientVersion: 'test' }), 'db P2002'],
    ['Prisma 접속 오류', () => new Prisma.PrismaClientInitializationError('private database connection', 'test'), 'db-init'],
    ['임의 name·code를 가진 오류', () => Object.assign(new Error('private database connection'), { name: '비밀 질문 이름', code: 'private-code' }), 'unknown'],
    ['Error가 아닌 값', () => ({ code: 'P1001', message: 'private' }), 'unknown'],
  ])('%s는 고정된 분류만 로그에 남긴다', async (_label, makeError, kind) => {
    db.create.mockRejectedValueOnce(makeError());
    expect((await POST(request({ text: '비밀 질문 전입신고' }))).status).toBe(503);
    expect(warn).toHaveBeenCalledWith(`[ask] 질문 처리 실패: ${kind}`);
    const logged = warn.mock.calls.flat().join(' ');
    expect(logged).not.toContain('비밀 질문');
    expect(logged).not.toContain('private');
  });
  // 질문자 기록: 로그인했으면 자체 DB 에만 남기고, 외부 AI 요청에는 넣지 않는다.
  it('로그인한 사용자의 질문은 askerId 를 저장한다', async () => {
    session.getSessionUser.mockResolvedValue({ id: 'user-1', nickname: '주민', role: 'MEMBER' });
    const response = await POST(request({ text: '전입신고는?' }));
    expect(response.status).toBe(200);
    expect(db.create.mock.calls[0][0].data.askerId).toBe('user-1');
  });

  it('세션을 읽지 못해도 질문은 받고 askerId 는 null 이다', async () => {
    session.getSessionUser.mockRejectedValue(new Error('SESSION_SECRET 없음'));
    const response = await POST(request({ text: '전입신고는?' }));
    expect(response.status).toBe(200);
    expect(db.create.mock.calls[0][0].data.askerId).toBeNull();
  });

  it('askerId · 닉네임은 외부 AI 요청에 실리지 않는다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    session.getSessionUser.mockResolvedValue({ id: 'user-secret-id', nickname: '비밀닉네임', role: 'MEMBER' });
    fetchMock.mockResolvedValue(ai());
    await POST(request({ text: '전입신고는?' }));
    const sent = String(fetchMock.mock.calls[0][1]?.body);
    expect(sent).not.toContain('user-secret-id');
    expect(sent).not.toContain('비밀닉네임');
    expect(db.create.mock.calls[0][0].data.askerId).toBe('user-secret-id');
  });
  // 지운 계정의 쿠키가 남아 있으면 askerId 외래키 위반으로 질문 전체가 503 이 된다. 로그인 없이 쓰는 기능이라 막히면 안 된다.
  it('지운 계정의 쿠키가 남아 있으면 askerId 는 null 이고 질문은 200 이다', async () => {
    session.getSessionUser.mockResolvedValue({ id: 'deleted-user', nickname: '탈퇴', role: 'MEMBER' });
    db.findUser.mockResolvedValue(null);
    const response = await POST(request({ text: '전입신고는?' }));
    expect(response.status).toBe(200);
    expect(db.create.mock.calls[0][0].data.askerId).toBeNull();
  });
});

describe('POST /api/ask 요청 횟수 제한', () => {
  const fromIp = (ip: string) => new Request('http://localhost/api/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ text: '전입신고는?' }),
  });
  const keys = () => db.queryRaw.mock.calls[0][0].values.filter((v: unknown) => typeof v === 'string');

  it('로그인 안 했으면 IP별 → 전체 순서로 센다', async () => {
    await POST(fromIp('203.0.113.7'));
    expect(keys()).toEqual([expect.stringMatching(/^askPerIp:[0-9a-f]{32}:\d+$/), expect.stringMatching(/^askTotal:\*:\d+$/)]);
  });

  it('로그인했으면 IP 대신 계정별로 센다 — 같은 Wi-Fi 의 로그인 사용자끼리 막지 않는다', async () => {
    session.getSessionUser.mockResolvedValue({ id: 'user-1', nickname: '주민', role: 'MEMBER' });
    await POST(fromIp('203.0.113.7'));
    expect(keys()).toEqual([expect.stringMatching(/^askPerUser:/), expect.stringMatching(/^askTotal:/)]);
  });

  it('전체 한도 직전(40번째)은 그대로 답한다', async () => {
    db.queryRaw.mockResolvedValue([{ c0: 1, c1: 40 }]);
    expect((await POST(fromIp('203.0.113.7'))).status).toBe(200);
  });

  it('전체 한도를 넘으면 429 이고 AI 를 부르지도 저장하지도 않는다', async () => {
    vi.stubEnv('GEMINI_ALLOW_USER_INPUT', 'true');
    db.queryRaw.mockResolvedValue([{ c0: 1, c1: 41 }]);
    const response = await POST(fromIp('203.0.113.7'));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(await response.json()).toEqual({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.create).not.toHaveBeenCalled();
  });

  it('IP 한도를 넘으면 429 다', async () => {
    db.queryRaw.mockResolvedValue([{ c0: 31, c1: null }]);
    expect((await POST(fromIp('203.0.113.7'))).status).toBe(429);
    expect(db.create).not.toHaveBeenCalled();
  });

  it('형식이 틀린 요청은 카운터를 올리지 않는다', async () => {
    expect((await POST(request({ text: '' }))).status).toBe(400);
    expect(db.queryRaw).not.toHaveBeenCalled();
  });
});
