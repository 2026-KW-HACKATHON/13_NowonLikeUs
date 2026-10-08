import { describe, it, expect } from 'vitest';
import { duplicateTitles, planSeed } from '@/lib/seedPlan';
import { seedTasks } from '@/prisma/seed-data';

describe('planSeed', () => {
  it('같은 제목이 이미 있으면 id 를 유지한 채 고친다', () => {
    const plan = planSeed([{ id: 'a', title: '전입신고' }], ['전입신고']);
    expect(plan).toEqual({ update: [{ id: 'a', title: '전입신고' }], create: [], remove: [] });
  });

  it('없는 제목은 새로 만든다', () => {
    const plan = planSeed([{ id: 'a', title: '전입신고' }], ['전입신고', '확정일자']);
    expect(plan.create).toEqual(['확정일자']);
  });

  it('시드 데이터에서 빠진 제목은 지운다', () => {
    const plan = planSeed(
      [
        { id: 'a', title: '전입신고' },
        { id: 'b', title: '없어진 항목' },
      ],
      ['전입신고'],
    );
    expect(plan.remove).toEqual(['b']);
    expect(plan.update.map((r) => r.id)).toEqual(['a']);
  });

  it('같은 제목 행이 여러 개면 가장 오래된(먼저 온) 행만 남기고 나머지는 지운다', () => {
    const plan = planSeed(
      [
        { id: 'old', title: '전입신고' },
        { id: 'new', title: '전입신고' },
      ],
      ['전입신고'],
    );
    expect(plan.update).toEqual([{ id: 'old', title: '전입신고' }]);
    expect(plan.remove).toEqual(['new']);
  });

  it('처음 시딩이면 전부 새로 만든다', () => {
    expect(planSeed([], ['가', '나'])).toEqual({ update: [], create: ['가', '나'], remove: [] });
  });

  it('두 번 돌려도 결과가 같다 — 두 번째에는 고치기만 한다', () => {
    const titles = ['가', '나'];
    const first = planSeed([], titles);
    const afterFirst = first.create.map((title, i) => ({ id: `id-${i}`, title }));
    const second = planSeed(afterFirst, titles);
    expect(second.create).toEqual([]);
    expect(second.remove).toEqual([]);
    expect(second.update.map((r) => r.id)).toEqual(['id-0', 'id-1']);
  });

  it('시드 데이터 안에서 제목이 겹치면 멈춘다 — 제목이 키다', () => {
    expect(() => planSeed([], ['전입신고', '전입신고'])).toThrow('같은 제목');
  });
});

describe('실제 시드 데이터', () => {
  it('제목이 겹치지 않는다', () => {
    expect(duplicateTitles(seedTasks.map((t) => t.title))).toEqual([]);
  });
});
