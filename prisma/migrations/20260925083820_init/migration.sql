-- CreateEnum
CREATE TYPE "HousingType" AS ENUM ('ONE_ROOM', 'OFFICETEL', 'DORM', 'APARTMENT', 'VILLA');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('MONTHLY', 'JEONSE', 'DORM_FEE', 'OWNED');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('ADMIN', 'WASTE', 'HOUSING', 'LIFE');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('SEED', 'PROMOTED');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('GROUNDED', 'PARTIAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('OPEN', 'ANSWERED', 'PROMOTED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "dueOffsetDays" INTEGER,
    "howTo" TEXT NOT NULL,
    "linkUrl" TEXT,
    "placeName" TEXT,
    "placeAddress" TEXT,
    "placePhone" TEXT,
    "category" "TaskCategory" NOT NULL,
    "housingTypes" "HousingType"[],
    "contractTypes" "ContractType"[],
    "requiresCar" BOOLEAN NOT NULL DEFAULT false,
    "requiresPet" BOOLEAN NOT NULL DEFAULT false,
    "studentOnly" BOOLEAN NOT NULL DEFAULT false,
    "source" "TaskSource" NOT NULL DEFAULT 'SEED',
    "promotedFromQuestionId" TEXT,
    "sourceNote" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "askerId" TEXT,
    "ctxHousingType" "HousingType",
    "ctxContractType" "ContractType",
    "aiAnswer" TEXT,
    "sourceIds" TEXT[],
    "confidence" "Confidence" NOT NULL DEFAULT 'UNKNOWN',
    "status" "QuestionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Confirmation" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Confirmation_answerId_userId_key" ON "Confirmation"("answerId", "userId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_askerId_fkey" FOREIGN KEY ("askerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
