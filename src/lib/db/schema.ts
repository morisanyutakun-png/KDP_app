import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  difficultyValues,
  formatValues,
  kdpStatusValues,
  productionStatusValues,
} from "@/lib/constants";

export const productionStatusEnum = pgEnum("production_status", productionStatusValues);
export const kdpStatusEnum = pgEnum("kdp_status", kdpStatusValues);
export const difficultyEnum = pgEnum("difficulty", difficultyValues);
export const editionFormatEnum = pgEnum("edition_format", formatValues);
export const importStatusEnum = pgEnum("import_status", ["PROCESSING", "COMPLETED", "FAILED"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const universities = pgTable("universities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("universities_slug_uidx").on(table.slug)]);

export const subjects = pgTable("subjects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("subjects_slug_uidx").on(table.slug)]);

export const series = pgTable("series", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  ...timestamps,
}, (table) => [uniqueIndex("series_slug_uidx").on(table.slug)]);

export const materials = pgTable("materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull(),
  problemStructure: text("problem_structure"),
  universityId: uuid("university_id").references(() => universities.id, { onDelete: "set null" }),
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  seriesId: uuid("series_id").references(() => series.id, { onDelete: "set null" }),
  difficulty: difficultyEnum("difficulty").default("ALL_LEVELS").notNull(),
  coverUrl: text("cover_url"),
  samplePdfUrl: text("sample_pdf_url"),
  publicationDate: date("publication_date"),
  productionStatus: productionStatusEnum("production_status").default("PLANNING").notNull(),
  kdpStatus: kdpStatusEnum("kdp_status").default("DRAFT").notNull(),
  notes: text("notes"),
  isPublished: boolean("is_published").default(false).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("materials_slug_uidx").on(table.slug),
  index("materials_publication_date_idx").on(table.publicationDate),
  index("materials_university_idx").on(table.universityId),
  index("materials_subject_idx").on(table.subjectId),
  index("materials_series_idx").on(table.seriesId),
]);

export const materialEditions = pgTable("material_editions", {
  id: uuid("id").defaultRandom().primaryKey(),
  materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  format: editionFormatEnum("format").notNull(),
  asin: text("asin"),
  isbn: text("isbn"),
  amazonUrl: text("amazon_url"),
  amazonTitle: text("amazon_title"),
  priceAmount: integer("price_amount"),
  priceCurrency: text("price_currency").default("JPY").notNull(),
  priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }),
  kdpStatus: kdpStatusEnum("kdp_status").default("DRAFT").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("material_editions_asin_uidx").on(table.asin),
  uniqueIndex("material_editions_material_format_uidx").on(table.materialId, table.format),
  index("material_editions_material_idx").on(table.materialId),
]);

export const salesImports = pgTable("sales_imports", {
  id: uuid("id").defaultRandom().primaryKey(),
  originalFilename: text("original_filename").notNull(),
  blobUrl: text("blob_url").notNull(),
  fileHash: text("file_hash").notNull(),
  status: importStatusEnum("status").default("PROCESSING").notNull(),
  totalRows: integer("total_rows").default(0).notNull(),
  importedRows: integer("imported_rows").default(0).notNull(),
  duplicateRows: integer("duplicate_rows").default(0).notNull(),
  unmatchedRows: integer("unmatched_rows").default(0).notNull(),
  columnMapping: jsonb("column_mapping").$type<Record<string, string>>(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [uniqueIndex("sales_imports_file_hash_uidx").on(table.fileHash)]);

export const salesRecords = pgTable("sales_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  importId: uuid("import_id").notNull().references(() => salesImports.id, { onDelete: "restrict" }),
  editionId: uuid("edition_id").references(() => materialEditions.id, { onDelete: "set null" }),
  asin: text("asin"),
  saleDate: date("sale_date").notNull(),
  units: integer("units").default(0).notNull(),
  royalty: numeric("royalty", { precision: 14, scale: 2 }),
  currency: text("currency"),
  marketplace: text("marketplace"),
  rowHash: text("row_hash").notNull(),
  rawData: jsonb("raw_data").$type<Record<string, string>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("sales_records_row_hash_uidx").on(table.rowHash),
  index("sales_records_date_idx").on(table.saleDate),
  index("sales_records_asin_idx").on(table.asin),
  index("sales_records_edition_idx").on(table.editionId),
]);

export const amazonClicks = pgTable("amazon_clicks", {
  id: uuid("id").defaultRandom().primaryKey(),
  editionId: uuid("edition_id").notNull().references(() => materialEditions.id, { onDelete: "cascade" }),
  clickedAt: timestamp("clicked_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("amazon_clicks_edition_idx").on(table.editionId),
  index("amazon_clicks_clicked_at_idx").on(table.clickedAt),
]);

export const changeLogs = pgTable("change_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: text("action").notNull(),
  snapshot: jsonb("snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("change_logs_entity_idx").on(table.entityType, table.entityId)]);

export type Material = typeof materials.$inferSelect;
export type MaterialEdition = typeof materialEditions.$inferSelect;
