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
export const problemVerificationStatusEnum = pgEnum("problem_verification_status", ["DRAFT", "REVIEWING", "VERIFIED", "NEEDS_REVISION"]);
export const mockExamStatusEnum = pgEnum("mock_exam_status", ["DRAFT", "READY", "ARCHIVED"]);

export type PaperSettings = {
  paperSize: "A4" | "B5";
  fontSize: number;
  marginMm: number;
  showPageNumbers: boolean;
  pageBreakPerProblem: boolean;
  columns: 1 | 2;
};

export const defaultPaperSettings: PaperSettings = {
  paperSize: "B5",
  fontSize: 11,
  marginMm: 16,
  showPageNumbers: true,
  pageBreakPerProblem: false,
  columns: 1,
};

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

export const problems = pgTable("problems", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  field: text("field").notNull(),
  subfield: text("subfield"),
  difficulty: integer("difficulty").notNull(),
  targetUniversity: text("target_university"),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  statement: text("statement").notNull(),
  answer: text("answer").default("").notNull(),
  explanation: text("explanation").default("").notNull(),
  imageUrl: text("image_url"),
  verificationStatus: problemVerificationStatusEnum("verification_status").default("DRAFT").notNull(),
  notes: text("notes"),
  isArchived: boolean("is_archived").default(false).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("problems_code_uidx").on(table.code),
  index("problems_subject_idx").on(table.subjectId),
  index("problems_field_idx").on(table.field),
  index("problems_difficulty_idx").on(table.difficulty),
  index("problems_target_university_idx").on(table.targetUniversity),
  index("problems_verification_idx").on(table.verificationStatus),
  index("problems_archived_idx").on(table.isArchived),
]);

export const mockTemplates = pgTable("mock_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  targetUniversity: text("target_university"),
  durationMinutes: integer("duration_minutes").notNull(),
  questionCount: integer("question_count").notNull(),
  paperSettings: jsonb("paper_settings").$type<PaperSettings>().default(defaultPaperSettings).notNull(),
  ...timestamps,
}, (table) => [index("mock_templates_subject_idx").on(table.subjectId)]);

export const mockExams = pgTable("mock_exams", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  targetUniversity: text("target_university"),
  durationMinutes: integer("duration_minutes").notNull(),
  questionCount: integer("question_count").notNull(),
  status: mockExamStatusEnum("status").default("DRAFT").notNull(),
  templateId: uuid("template_id").references(() => mockTemplates.id, { onDelete: "set null" }),
  paperSettings: jsonb("paper_settings").$type<PaperSettings>().default(defaultPaperSettings).notNull(),
  ...timestamps,
}, (table) => [
  index("mock_exams_subject_idx").on(table.subjectId),
  index("mock_exams_status_idx").on(table.status),
]);

export const mockExamItems = pgTable("mock_exam_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  mockExamId: uuid("mock_exam_id").notNull().references(() => mockExams.id, { onDelete: "cascade" }),
  problemId: uuid("problem_id").references(() => problems.id, { onDelete: "restrict" }),
  position: integer("position").notNull(),
  fieldFilter: text("field_filter"),
  subfieldFilter: text("subfield_filter"),
  difficultyMin: integer("difficulty_min"),
  difficultyMax: integer("difficulty_max"),
  unusedOnly: boolean("unused_only").default(false).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("mock_exam_items_exam_position_uidx").on(table.mockExamId, table.position),
  index("mock_exam_items_exam_idx").on(table.mockExamId),
  index("mock_exam_items_problem_idx").on(table.problemId),
]);

export type Material = typeof materials.$inferSelect;
export type MaterialEdition = typeof materialEditions.$inferSelect;
export type Problem = typeof problems.$inferSelect;
export type MockTemplate = typeof mockTemplates.$inferSelect;
export type MockExam = typeof mockExams.$inferSelect;
export type MockExamItem = typeof mockExamItems.$inferSelect;
