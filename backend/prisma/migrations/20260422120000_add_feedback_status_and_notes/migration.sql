-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED', 'DONE');

-- AlterTable
ALTER TABLE "feedback" ADD COLUMN "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN';
