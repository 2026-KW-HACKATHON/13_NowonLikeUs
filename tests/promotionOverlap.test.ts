import { describe, it, expect } from 'vitest';
import { canShareViewer, findOverlaps, sharedConditions } from '@/lib/promotionOverlap';
import type { AdminTaskSummary, TaskConditions } from '@/lib/types';

const none: TaskConditions = { housingTypes: [], contractTypes: [], requiresCar: false, requiresPet: false, studentOnly: false };

function task(id: string, over: Partial<AdminTaskSummary> = {}): AdminTaskSummary {
  return { id, title: id, category: 'LIFE', ...none, ...over };
}

const dogRegistration = task('반려견 동물등록하기', { requiresPet: true });
const moveIn = task('전입신고 하기', { category: 'ADMIN' });
const fixedDate = task('확정일자 받기', { category: 'HOUSING', contractTypes: ['MONTHLY', 'JEONSE'] });
const dormCert = task('빛솔재 거주증명서', { category: 'ADMIN', housingTypes: ['DORM'] });
const parking = task('거주자 우선주차', { requiresCar: true, housingTypes: ['ONE_ROOM', 'VILLA'] });

describe('canShareViewer', () => {
  it('조건 없음은 누구와도 겹친다', () => {
    expect(canShareViewer(none, { ...none, housingTypes: ['DORM'] })).toBe(true);
  });

  it('주거형태가 서로 다르면 같은 사람에게 보일 수 없다', () => {
    expect(canShareViewer({ ...none, housingTypes: ['DORM'] }, { ...none, housingTypes: ['APARTMENT'] })).toBe(false);
  });

  it('계약형태가 서로 다르면 같은 사람에게 보일 수 없다', () => {
    expect(canShareViewer({ ...none, contractTypes: ['DORM_FEE'] }, { ...none, contractTypes: ['MONTHLY'] })).toBe(false);
  });

  it('하나라도 같은 주거형태가 있으면 겹친다', () => {
    expect(canShareViewer({ ...none, housingTypes: ['DORM', 'VILLA'] }, { ...none, housingTypes: ['VILLA'] })).toBe(true);
  });

  it('차 · 강아지 · 학생은 서로 막지 않는다 — 한 사람이 다 가질 수 있다', () => {
    expect(canShareViewer({ ...none, requiresCar: true }, { ...none, requiresPet: true, studentOnly: true })).toBe(true);
  });
});

describe('sharedConditions', () => {
  it('둘 다 좁힌 조건만 센다', () => {
    expect(
      sharedConditions(
        { ...none, housingTypes: ['DORM'], requiresPet: true },
        { ...none, housingTypes: ['DORM', 'VILLA'], requiresPet: true, studentOnly: true },
      ),
    ).toEqual(['기숙사', '강아지']);
  });

  it('한쪽이 조건 없음이면 겹치는 조건이 아니다', () => {
    expect(sharedConditions({ ...none, housingTypes: ['DORM'] }, none)).toEqual([]);
  });

  it('같은 계약형태 · 차 · 학생도 이름으로', () => {
    expect(
      sharedConditions(
        { ...none, contractTypes: ['MONTHLY'], requiresCar: true, studentOnly: true },
        { ...none, contractTypes: ['MONTHLY', 'JEONSE'], requiresCar: true, studentOnly: true },
      ),
    ).toEqual(['월세', '차', '학생']);
  });
});

describe('findOverlaps', () => {
  const all = [moveIn, fixedDate, dormCert, parking, dogRegistration];

  it('기숙사 강아지 규칙을 쓰면 반려견 동물등록이 겹치는 할 일로 먼저 뜬다', () => {
    const { related } = findOverlaps({ ...none, housingTypes: ['DORM'], requiresPet: true }, all);
    expect(related.map((r) => [r.task.id, r.shared])).toEqual([
      ['빛솔재 거주증명서', ['기숙사']],
      ['반려견 동물등록하기', ['강아지']],
    ]);
  });

  it('모두에게 보이는 할 일은 넓게 보이는 쪽으로 따로 묶는다', () => {
    const { general } = findOverlaps({ ...none, housingTypes: ['DORM'], requiresPet: true }, all);
    expect(general.map((t) => t.id)).toEqual(['전입신고 하기', '확정일자 받기']);
  });

  it('같은 사람에게 보일 수 없는 할 일은 뺀다', () => {
    const { related, general } = findOverlaps({ ...none, housingTypes: ['DORM'] }, all);
    const ids = [...related.map((r) => r.task.id), ...general.map((t) => t.id)];
    expect(ids).not.toContain('거주자 우선주차');
  });

  it('겹치는 조건이 많은 할 일이 먼저', () => {
    const both = task('기숙사 강아지 산책 규칙', { housingTypes: ['DORM'], requiresPet: true });
    const { related } = findOverlaps({ ...none, housingTypes: ['DORM'], requiresPet: true }, [dogRegistration, dormCert, both]);
    expect(related[0].task.id).toBe('기숙사 강아지 산책 규칙');
  });

  it('조건 없는 새 할 일은 모든 할 일과 넓게만 겹친다', () => {
    const { related, general } = findOverlaps(none, all);
    expect(related).toEqual([]);
    expect(general).toHaveLength(all.length);
  });

  it('할 일이 없으면 둘 다 빈 목록', () => {
    expect(findOverlaps(none, [])).toEqual({ related: [], general: [] });
  });
});
