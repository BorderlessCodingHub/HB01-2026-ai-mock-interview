-- CreateTable
CREATE TABLE "topic_coverage" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "session_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_coverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "topic_coverage_user_id_created_at_idx" ON "topic_coverage"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "topic_coverage_session_id_idx" ON "topic_coverage"("session_id");

-- AddForeignKey
ALTER TABLE "topic_coverage" ADD CONSTRAINT "topic_coverage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_coverage" ADD CONSTRAINT "topic_coverage_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
