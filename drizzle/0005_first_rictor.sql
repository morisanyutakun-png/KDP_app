CREATE TYPE "public"."mock_exam_origin" AS ENUM('USER', 'IMPORT');--> statement-breakpoint
ALTER TABLE "mock_exams" ADD COLUMN "origin" "mock_exam_origin" DEFAULT 'USER' NOT NULL;--> statement-breakpoint
CREATE INDEX "mock_exams_origin_idx" ON "mock_exams" USING btree ("origin");--> statement-breakpoint
-- 取り込み由来（全ての大問が IMP- 始まりの問題で埋まっている模試）を出典として区別する。
UPDATE "mock_exams" SET "origin" = 'IMPORT'
WHERE EXISTS (
  SELECT 1 FROM "mock_exam_items" i
  WHERE i."mock_exam_id" = "mock_exams"."id" AND i."problem_id" IS NOT NULL
) AND NOT EXISTS (
  SELECT 1 FROM "mock_exam_items" i
  LEFT JOIN "problems" p ON p."id" = i."problem_id"
  WHERE i."mock_exam_id" = "mock_exams"."id"
    AND (i."problem_id" IS NULL OR p."code" NOT LIKE 'IMP-%')
);