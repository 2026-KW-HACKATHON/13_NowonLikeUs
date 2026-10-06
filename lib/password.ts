import bcrypt from 'bcryptjs';

const COST = 10;

/**
 * 없는 계정으로 로그인할 때 비교에 쓰는 가짜 해시.
 * 없는 계정이라고 비교를 건너뛰면 응답이 눈에 띄게 빨라져, 시간만으로 가입 여부를 알아낼 수 있다.
 */
const DUMMY_HASH = bcrypt.hashSync('wolgye-dummy-password-for-timing', COST);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

/**
 * 비밀번호가 해시와 맞는지 본다.
 * hash 가 null 이면(없는 계정) 가짜 해시와 한 번 비교한 뒤 항상 false 를 돌려준다.
 * 깨진 해시가 들어와도 예외를 던지지 않고 false 다.
 */
export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  try {
    const matched = await bcrypt.compare(plain, hash ?? DUMMY_HASH);
    return hash !== null && matched;
  } catch {
    return false;
  }
}
