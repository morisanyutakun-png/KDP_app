CREATE TYPE "public"."mock_exam_status" AS ENUM('DRAFT', 'READY', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."problem_verification_status" AS ENUM('DRAFT', 'REVIEWING', 'VERIFIED', 'NEEDS_REVISION');--> statement-breakpoint
CREATE TABLE "mock_exam_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mock_exam_id" uuid NOT NULL,
	"problem_id" uuid,
	"position" integer NOT NULL,
	"field_filter" text,
	"subfield_filter" text,
	"difficulty_min" integer,
	"difficulty_max" integer,
	"unused_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subject_id" uuid,
	"target_university" text,
	"duration_minutes" integer NOT NULL,
	"question_count" integer NOT NULL,
	"status" "mock_exam_status" DEFAULT 'DRAFT' NOT NULL,
	"template_id" uuid,
	"paper_settings" jsonb DEFAULT '{"paperSize":"B5","fontSize":11,"marginMm":16,"showPageNumbers":true,"pageBreakPerProblem":false,"columns":1}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mock_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"subject_id" uuid,
	"target_university" text,
	"duration_minutes" integer NOT NULL,
	"question_count" integer NOT NULL,
	"paper_settings" jsonb DEFAULT '{"paperSize":"B5","fontSize":11,"marginMm":16,"showPageNumbers":true,"pageBreakPerProblem":false,"columns":1}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"subject_id" uuid,
	"field" text NOT NULL,
	"subfield" text,
	"difficulty" integer NOT NULL,
	"target_university" text,
	"estimated_minutes" integer NOT NULL,
	"statement" text NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"image_url" text,
	"verification_status" "problem_verification_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mock_exam_items" ADD CONSTRAINT "mock_exam_items_mock_exam_id_mock_exams_id_fk" FOREIGN KEY ("mock_exam_id") REFERENCES "public"."mock_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_exam_items" ADD CONSTRAINT "mock_exam_items_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_exams" ADD CONSTRAINT "mock_exams_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_exams" ADD CONSTRAINT "mock_exams_template_id_mock_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."mock_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_templates" ADD CONSTRAINT "mock_templates_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mock_exam_items_exam_position_uidx" ON "mock_exam_items" USING btree ("mock_exam_id","position");--> statement-breakpoint
CREATE INDEX "mock_exam_items_exam_idx" ON "mock_exam_items" USING btree ("mock_exam_id");--> statement-breakpoint
CREATE INDEX "mock_exam_items_problem_idx" ON "mock_exam_items" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "mock_exams_subject_idx" ON "mock_exams" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "mock_exams_status_idx" ON "mock_exams" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mock_templates_subject_idx" ON "mock_templates" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "problems_code_uidx" ON "problems" USING btree ("code");--> statement-breakpoint
CREATE INDEX "problems_subject_idx" ON "problems" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "problems_field_idx" ON "problems" USING btree ("field");--> statement-breakpoint
CREATE INDEX "problems_difficulty_idx" ON "problems" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "problems_target_university_idx" ON "problems" USING btree ("target_university");--> statement-breakpoint
CREATE INDEX "problems_verification_idx" ON "problems" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "problems_archived_idx" ON "problems" USING btree ("is_archived");