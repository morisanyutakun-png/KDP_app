ALTER TABLE "material_editions" ADD COLUMN "amazon_title" text;--> statement-breakpoint
ALTER TABLE "material_editions" ADD COLUMN "price_amount" integer;--> statement-breakpoint
ALTER TABLE "material_editions" ADD COLUMN "price_currency" text DEFAULT 'JPY' NOT NULL;--> statement-breakpoint
ALTER TABLE "material_editions" ADD COLUMN "price_updated_at" timestamp with time zone;