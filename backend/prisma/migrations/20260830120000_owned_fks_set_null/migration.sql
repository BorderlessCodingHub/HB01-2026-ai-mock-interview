-- Keep practice sessions when a resume is deleted.
ALTER TABLE "interview_sessions" DROP CONSTRAINT "interview_sessions_resume_id_fkey";
ALTER TABLE "interview_sessions" ALTER COLUMN "resume_id" DROP NOT NULL;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep study backlog, weak answers, and coverage when a practice session is deleted.
ALTER TABLE "review_items" DROP CONSTRAINT "review_items_session_id_fkey";
ALTER TABLE "review_items" ALTER COLUMN "session_id" DROP NOT NULL;
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "weak_answers" DROP CONSTRAINT "weak_answers_session_id_fkey";
ALTER TABLE "weak_answers" ALTER COLUMN "session_id" DROP NOT NULL;
ALTER TABLE "weak_answers" ADD CONSTRAINT "weak_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "topic_coverage" DROP CONSTRAINT "topic_coverage_session_id_fkey";
ALTER TABLE "topic_coverage" ALTER COLUMN "session_id" DROP NOT NULL;
ALTER TABLE "topic_coverage" ADD CONSTRAINT "topic_coverage_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
