-- CreateEnum
CREATE TYPE "SessionQuotaKind" AS ENUM ('practice', 'study');

-- CreateTable
CREATE TABLE "session_quota_events" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "kind" "SessionQuotaKind" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_quota_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_quota_events_user_id_kind_created_at_idx" ON "session_quota_events"("user_id", "kind", "created_at");

-- AddForeignKey
ALTER TABLE "session_quota_events" ADD CONSTRAINT "session_quota_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
