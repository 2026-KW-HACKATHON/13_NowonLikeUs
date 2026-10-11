import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { task: { findMany: db.findMany } } }));
const auth = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/auth', () => ({ requireAdmin: auth.requireAdmin }));
import { GET } from '@/app/api/admin/tasks/route';

/** 화면(TaskOverlapPanel)이 쓰는 값. 이것 말고는 응답에 실리면 안 된다. */
const FIELDS = ['category', 'contractTypes', 'housingTypes', 'id', 'requiresCar', 'requiresPet', 'studentOnly', 'title'];

const dogRegistration = {
  id: 't1',
  title: '반려견 동물등록하기',
  category: 'LIFE',
  housingTypes: [],
  contractTypes: [],
  requiresCar: false,
  requiresPet: true,
  studentOnly: false,
};
const dormNoDogs = {
  id: 't2',
  title: '빛솔재에는 강아지를 데려올 수 없어요',
  category: 'HOUSING',
  housingTypes: ['DORM'],
  contractTypes: [],
  requiresCar: false,
  requiresPet: false,
  studentOnly: true,
};

beforeEach(() => {
  auth.requireAdmin.mockResolvedValue({ id: 'admin', nickname: '운영자', role: 'ADMIN' });
  db.findMany.mockResolvedValue([dogRegistration, dormNoDogs]);
});
afterEach(() => vi.resetAllMocks());

describe('GET /api/admin/tasks', () => {
  it('로그인하지 않았으면 401, DB 를 읽지 않는다', async () => {
    auth.requireAdmin.mockResolvedValueOnce(Response.json({ error: '로그인이 필요합니다.' }, { status: 401 }));
    expect((await GET()).status).toBe(401);
    expect(db.findMany).not.toHaveBeenCalled();
  });

  it('일반 회원이면 403, DB 를 읽지 않는다', async () => {
    auth.requireAdmin.mockResolvedValueOnce(Response.json({ error: '운영자만 할 수 있습니다.' }, { status: 403 }));
    expect((await GET()).status).toBe(403);
    expect(db.findMany).not.toHaveBeenCalled();
  });

  it('운영자면 200 + 발행된 할 일 전부, 캐시하지 않는다', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ tasks: [dogRegistration, dormNoDogs] });
  });

  it('발행된 할 일만, 만든 순으로 고정해서 꺼낸다', async () => {
    await GET();
    const query = db.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ isPublished: true });
    expect(query.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
  });

  // 이유 · 방법 · 장소 · 출처는 화면이 쓰지 않는다. DB 에서부터 꺼내지 않는다.
  it('제목 · 분류 · 노출 조건만 꺼낸다', async () => {
    await GET();
    const { select } = db.findMany.mock.calls[0][0];
    expect(Object.keys(select).sort()).toEqual(FIELDS);
    expect(Object.values(select).every((v) => v === true)).toBe(true);
  });

  it('할 일이 없으면 빈 목록', async () => {
    db.findMany.mockResolvedValueOnce([]);
    expect(await (await GET()).json()).toEqual({ tasks: [] });
  });
});
