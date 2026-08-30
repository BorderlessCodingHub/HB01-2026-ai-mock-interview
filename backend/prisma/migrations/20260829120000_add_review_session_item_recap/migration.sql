-- AlterTable
ALTER TABLE "review_session_items" ADD COLUMN "went_well" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "review_session_items" ADD COLUMN "work_on" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
