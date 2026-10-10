-- 노원 동네 인증. 인증한 시각만 남긴다 — 좌표는 서버로 오지도, 저장되지도 않는다.
-- 기존 계정은 그대로다 — 비어 있어도 되는(nullable) 컬럼 하나만 더한다.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "neighborhoodVerifiedAt" TIMESTAMP(3);
