import { prisma } from '../lib/db';
import { validateSignup } from '../lib/authValidation';
import { hashPassword } from '../lib/password';

/*
 * 운영자 계정을 만든다(이미 있으면 ADMIN 으로 올리고 비밀번호를 바꾼다).
 * 가입 API 로는 ADMIN 을 만들 수 없게 해 두었으므로, 운영자는 이 스크립트로만 생긴다.
 *
 * 값은 .env 의 ADMIN_EMAIL · ADMIN_PASSWORD · ADMIN_NICKNAME(선택, 기본 "운영자")에서 읽는다.
 * 값을 코드 · 문서 · 커밋 · 로그 어디에도 남기지 않는다.
 */

function loadDotEnv(): void {
  try {
    process.loadEnvFile('.env');
  } catch {
    // .env 가 없으면 이미 환경변수로 들어와 있다고 본다.
  }
}

async function main() {
  loadDotEnv();

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const nickname = process.env.ADMIN_NICKNAME || '운영자';
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL 과 ADMIN_PASSWORD 환경변수가 필요합니다. .env 에 추가하세요.');
  }

  // 가입과 같은 규칙(이메일 형식, 비밀번호 8자 이상 72바이트 이하, 닉네임 길이)을 그대로 통과해야 한다.
  const input = validateSignup({ email, password, nickname });
  if (!input.ok) {
    throw new Error(`운영자 계정 값이 규칙에 맞지 않습니다: ${input.error}`);
  }

  const passwordHash = await hashPassword(input.value.password);
  const admin = await prisma.user.upsert({
    where: { email: input.value.email },
    update: { passwordHash, nickname: input.value.nickname, role: 'ADMIN' },
    create: { email: input.value.email, passwordHash, nickname: input.value.nickname, role: 'ADMIN' },
    select: { nickname: true },
  });

  // 이메일은 로그에 남기지 않는다.
  console.log(`운영자 계정을 준비했습니다: ${admin.nickname}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
