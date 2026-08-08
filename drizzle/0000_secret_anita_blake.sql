CREATE TYPE "public"."difficulty" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS');--> statement-breakpoint
CREATE TYPE "public"."edition_format" AS ENUM('KINDLE', 'PAPERBACK', 'HARDCOVER', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."kdp_status" AS ENUM('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'LIVE', 'BLOCKED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."production_status" AS ENUM('PLANNING', 'WRITING', 'PROOFREADING', 'PDF_REVIEW', 'SUBMITTED', 'IN_REVIEW', 'PUBLISHED', 'ON_HOLD', 'REVISING');--> statement-breakpoint
CREATE TABLE "amazon_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" uuid NOT NULL,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"format" "edition_format" NOT NULL,
	"asin" text,
	"isbn" text,
	"amazon_url" text,
	"kdp_status" "kdp_status" DEFAULT 'DRAFT' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"university_id" uuid,
	"subject_id" uuid,
	"series_id" uuid,
	"difficulty" "difficulty" DEFAULT 'ALL_LEVELS' NOT NULL,
	"cover_url" text,
	"sample_pdf_url" text,
	"publication_date" date,
	"production_status" "production_status" DEFAULT 'PLANNING' NOT NULL,
	"kdp_status" "kdp_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_filename" text NOT NULL,
	"blob_url" text NOT NULL,
	"file_hash" text NOT NULL,
	"status" "import_status" DEFAULT 'PROCESSING' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"duplicate_rows" integer DEFAULT 0 NOT NULL,
	"unmatched_rows" integer DEFAULT 0 NOT NULL,
	"column_mapping" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sales_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"edition_id" uuid,
	"asin" text,
	"sale_date" date NOT NULL,
	"units" integer DEFAULT 0 NOT NULL,
	"royalty" numeric(14, 2),
	"currency" text,
	"marketplace" text,
	"row_hash" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "universities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "amazon_clicks" ADD CONSTRAINT "amazon_clicks_edition_id_material_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."material_editions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_editions" ADD CONSTRAINT "material_editions_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_records" ADD CONSTRAINT "sales_records_import_id_sales_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."sales_imports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_records" ADD CONSTRAINT "sales_records_edition_id_material_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."material_editions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "amazon_clicks_edition_idx" ON "amazon_clicks" USING btree ("edition_id");--> statement-breakpoint
CREATE INDEX "amazon_clicks_clicked_at_idx" ON "amazon_clicks" USING btree ("clicked_at");--> statement-breakpoint
CREATE INDEX "change_logs_entity_idx" ON "change_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_editions_asin_uidx" ON "material_editions" USING btree ("asin");--> statement-breakpoint
CREATE UNIQUE INDEX "material_editions_material_format_uidx" ON "material_editions" USING btree ("material_id","format");--> statement-breakpoint
CREATE INDEX "material_editions_material_idx" ON "material_editions" USING btree ("material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "materials_slug_uidx" ON "materials" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "materials_publication_date_idx" ON "materials" USING btree ("publication_date");--> statement-breakpoint
CREATE INDEX "materials_university_idx" ON "materials" USING btree ("university_id");--> statement-breakpoint
CREATE INDEX "materials_subject_idx" ON "materials" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "materials_series_idx" ON "materials" USING btree ("series_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_imports_file_hash_uidx" ON "sales_imports" USING btree ("file_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_records_row_hash_uidx" ON "sales_records" USING btree ("row_hash");--> statement-breakpoint
CREATE INDEX "sales_records_date_idx" ON "sales_records" USING btree ("sale_date");--> statement-breakpoint
CREATE INDEX "sales_records_asin_idx" ON "sales_records" USING btree ("asin");--> statement-breakpoint
CREATE INDEX "sales_records_edition_idx" ON "sales_records" USING btree ("edition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "series_slug_uidx" ON "series" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_slug_uidx" ON "subjects" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "universities_slug_uidx" ON "universities" USING btree ("slug");