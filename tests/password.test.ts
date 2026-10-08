import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';

describe('hashPassword · verifyPassword', () => {
  it('맞는 비밀번호는 통과한다', async () => {
    const hash = await hashPassword('abcd1234');
    expect(await verifyPassword('abcd1234', hash)).toBe(true);
  });

  it('틀린 비밀번호는 거절한다', async () => {
    const hash = await hashPassword('abcd1234');
    expect(await verifyPassword('abcd12345', hash)).toBe(false);
  });

  it('해시에 원문이 들어 있지 않다', async () => {
    expect(await hashPassword('abcd1234')).not.toContain('abcd1234');
  });

  // 소금이 매번 달라야 한다. 같으면 같은 비밀번호를 쓰는 사람을 DB 에서 알아볼 수 있다.
  it('같은 비밀번호도 해시는 매번 다르다', async () => {
    expect(await hashPassword('abcd1234')).not.toBe(await hashPassword('abcd1234'));
  });

  // 이 테스트는 "거절하고 예외를 안 던진다"만 확인한다. 구현은 없는 계정이어도 가짜 해시와
  // 비교를 한 번 돌려서 응답 시간으로 가입 여부를 알아내지 못하게 해야 하는데, 시간은
  // 단위 테스트로 안정적으로 잡을 수 없다. 그 부분은 코드 리뷰에서 눈으로 확인한다.
  it('해시가 없으면(없는 계정) 항상 거절하되 예외를 던지지 않는다', async () => {
    expect(await verifyPassword('abcd1234', null)).toBe(false);
  });

  it('깨진 해시가 들어와도 예외 없이 거절한다', async () => {
    expect(await verifyPassword('abcd1234', 'not-a-bcrypt-hash')).toBe(false);
  });
});
