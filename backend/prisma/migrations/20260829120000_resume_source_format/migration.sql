-- CreateEnum
CREATE TYPE "ResumeSourceFormat" AS ENUM ('pdf', 'tex');

-- AlterTable
ALTER TABLE "resumes" ADD COLUMN "source_format" "ResumeSourceFormat";

UPDATE "resumes" SET "source_format" = 'pdf' WHERE "source_format" IS NULL;

ALTER TABLE "resumes" ALTER COLUMN "source_format" SET NOT NULL;

ALTER TABLE "resumes" DROP COLUMN "pdf_url";
