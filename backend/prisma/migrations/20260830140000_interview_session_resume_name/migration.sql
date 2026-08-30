-- Snapshot the CV filename on each practice session so deleting a resume
-- does not erase the label used in history and feedback.
ALTER TABLE "interview_sessions" ADD COLUMN "resume_name" TEXT;

UPDATE "interview_sessions" AS s
SET "resume_name" = r."name"
FROM "resumes" AS r
WHERE s."resume_id" = r."id";

UPDATE "interview_sessions"
SET "resume_name" = 'Resume'
WHERE "resume_name" IS NULL;

ALTER TABLE "interview_sessions" ALTER COLUMN "resume_name" SET NOT NULL;
ALTER TABLE "interview_sessions" ALTER COLUMN "resume_name" SET DEFAULT 'Resume';
