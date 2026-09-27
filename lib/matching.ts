import type { Profile, TaskConditions } from './types';

/**
 * 할 일의 노출 조건이 이 프로필에 해당하는지 판정한다.
 * 빈 배열과 false는 "조건 없음"이므로 전원에게 해당한다.
 * 조건이 하나라도 어긋나면 false다.
 */
export function matchesProfile(conditions: TaskConditions, profile: Profile): boolean {
  if (conditions.housingTypes.length > 0 && !conditions.housingTypes.includes(profile.housingType)) {
    return false;
  }
  if (conditions.contractTypes.length > 0 && !conditions.contractTypes.includes(profile.contractType)) {
    return false;
  }
  if (conditions.requiresCar && !profile.hasCar) return false;
  if (conditions.requiresPet && !profile.hasPet) return false;
  if (conditions.studentOnly && !profile.isStudent) return false;
  return true;
}

export function filterByProfile<T extends TaskConditions>(items: T[], profile: Profile): T[] {
  return items.filter((item) => matchesProfile(item, profile));
}