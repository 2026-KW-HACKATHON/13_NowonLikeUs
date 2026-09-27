import { describe, it, expect } from 'vitest';
import { matchesProfile, filterByProfile } from '@/lib/matching';
import type { Profile, TaskConditions, ContractType } from '@/lib/types';

const jeonseOneRoom: Profile = {
  zone: 'A',
  housingType: 'ONE_ROOM',
  contractType: 'JEONSE',
  moveInDate: '2026-03-02',
  hasCar: false,
  hasPet: false,
  isStudent: true,
};

const noConditions: TaskConditions = {
  housingTypes: [],
  contractTypes: [],
  requiresCar: false,
  requiresPet: false,
  studentOnly: false,
};

describe('matchesProfile', () => {
  it('조건이 전부 비어 있으면 누구에게나 해당한다', () => {
    expect(matchesProfile(noConditions, jeonseOneRoom)).toBe(true);
  });

  it('거주형태가 목록에 있으면 해당한다', () => {
    expect(matchesProfile({ ...noConditions, housingTypes: ['ONE_ROOM', 'VILLA'] }, jeonseOneRoom)).toBe(true);
  });

  it('거주형태가 목록에 없으면 해당하지 않는다', () => {
    expect(matchesProfile({ ...noConditions, housingTypes: ['APARTMENT'] }, jeonseOneRoom)).toBe(false);
  });

  it('계약형태가 목록에 없으면 해당하지 않는다', () => {
    expect(matchesProfile({ ...noConditions, contractTypes: ['DORM_FEE'] }, jeonseOneRoom)).toBe(false);
  });

  it('차량이 필요한 항목은 차량 없는 사람에게 보이지 않는다', () => {
    expect(matchesProfile({ ...noConditions, requiresCar: true }, jeonseOneRoom)).toBe(false);
    expect(matchesProfile({ ...noConditions, requiresCar: true }, { ...jeonseOneRoom, hasCar: true })).toBe(true);
  });

  it('반려동물이 필요한 항목은 반려동물 없는 사람에게 보이지 않는다', () => {
    expect(matchesProfile({ ...noConditions, requiresPet: true }, jeonseOneRoom)).toBe(false);
  });

  it('학생 전용 항목은 비학생에게 보이지 않는다', () => {
    expect(matchesProfile({ ...noConditions, studentOnly: true }, { ...jeonseOneRoom, isStudent: false })).toBe(false);
  });

  it('조건 중 하나만 어긋나도 해당하지 않는다', () => {
    const c: TaskConditions = { ...noConditions, housingTypes: ['ONE_ROOM'], requiresCar: true };
    expect(matchesProfile(c, jeonseOneRoom)).toBe(false);
  });
});

describe('filterByProfile', () => {
  it('해당하는 항목만 남긴다', () => {
    const items = [
      { id: 'a', ...noConditions },
      { id: 'b', ...noConditions, contractTypes: ['DORM_FEE'] as ContractType[] },
      { id: 'c', ...noConditions, contractTypes: ['JEONSE'] as ContractType[] },
    ];
    expect(filterByProfile(items, jeonseOneRoom).map((i) => i.id)).toEqual(['a', 'c']);
  });
});