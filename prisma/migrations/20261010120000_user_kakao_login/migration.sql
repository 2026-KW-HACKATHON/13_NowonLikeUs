-- 카카오 로그인. 카카오 계정은 이메일 · 비밀번호 없이 카카오 회원번호만 가진다.
-- 기존 계정은 그대로다 — 컬럼을 하나 더하고 필수 조건만 푼다.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kakaoId" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_kakaoId_key" ON "User"("kakaoId");
