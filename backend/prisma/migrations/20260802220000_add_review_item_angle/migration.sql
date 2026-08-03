-- AlterTable: add angle to review_items (nullable first for backfill)
ALTER TABLE "review_items" ADD COLUMN "angle" TEXT;

UPDATE "review_items" SET "angle" = 'general' WHERE "angle" IS NULL;

ALTER TABLE "review_items" ALTER COLUMN "angle" SET NOT NULL;

-- AlterTable: add angle to review_session_items
ALTER TABLE "review_session_items" ADD COLUMN "angle" TEXT;

UPDATE "review_session_items" AS rsi
SET "angle" = COALESCE(
  (SELECT ri."angle" FROM "review_items" AS ri WHERE ri."id" = rsi."review_item_id"),
  'general'
)
WHERE rsi."angle" IS NULL;

ALTER TABLE "review_session_items" ALTER COLUMN "angle" SET NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "review_items_user_id_topic_key";

-- CreateIndex
CREATE UNIQUE INDEX "review_items_user_id_topic_angle_key" ON "review_items"("user_id", "topic", "angle");
