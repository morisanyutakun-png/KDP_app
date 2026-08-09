import "server-only";

import { and, eq, ne } from "drizzle-orm";
import Papa from "papaparse";
import { getDb } from "@/lib/db";
import { changeLogs, materialEditions, materials, series, subjects, universities } from "@/lib/db/schema";
import { difficultyValues, formatValues } from "@/lib/constants";
import { slugify } from "@/lib/utils";

type CsvRow = Record<string, string | undefined>;
type EditionFormat = (typeof formatValues)[number];
type Difficulty = (typeof difficultyValues)[number];

export type MaterialCsvDefaults = {
  format: EditionFormat;
  isPublished: boolean;
};

export type MaterialCsvImportResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

const aliases = {
  title: ["タイトル", "title", "教材名", "商品名"],
  asin: ["asin", "ASIN"],
  problemStructure: ["問題構成", "problemstructure", "problem_structure"],
  description: ["説明", "description", "商品説明"],
  university: ["大学", "university"],
  subject: ["科目", "subject"],
  series: ["シリーズ", "series"],
  difficulty: ["難易度", "difficulty"],
  format: ["販売形式", "形式", "format"],
  amazonUrl: ["amazonurl", "amazon url", "amazon_url", "Amazon URL"],
  isPublished: ["公開", "published", "isPublished", "is_published"],
} as const;

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").normalize("NFKC").trim().toLowerCase().replace(/[ _-]+/g, "");
}

function field(row: CsvRow, names: readonly string[]) {
  const wanted = new Set(names.map(normalizeHeader));
  const entry = Object.entries(row).find(([key]) => wanted.has(normalizeHeader(key)));
  return entry?.[1]?.normalize("NFKC").trim() || "";
}

function normalizeAsin(value: string) {
  return value.replace(/^ASIN\s*[:：]\s*/i, "").replace(/\s+/g, "").toUpperCase();
}

function parseFormat(value: string, fallback: EditionFormat): EditionFormat | null {
  if (!value) return fallback;
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  const map: Record<string, EditionFormat> = {
    kindle: "KINDLE", ebook: "KINDLE", 電子書籍: "KINDLE",
    paperback: "PAPERBACK", ペーパーバック: "PAPERBACK", 紙書籍: "PAPERBACK",
    hardcover: "HARDCOVER", ハードカバー: "HARDCOVER",
    other: "OTHER", その他: "OTHER",
  };
  return map[normalized] || (formatValues.includes(value.toUpperCase() as EditionFormat) ? value.toUpperCase() as EditionFormat : null);
}

function parseDifficulty(value: string): Difficulty | null {
  if (!value) return null;
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  const map: Record<string, Difficulty> = {
    beginner: "BEGINNER", 初級: "BEGINNER",
    intermediate: "INTERMEDIATE", 中級: "INTERMEDIATE",
    advanced: "ADVANCED", 上級: "ADVANCED",
    all_levels: "ALL_LEVELS", alllevels: "ALL_LEVELS", 全レベル: "ALL_LEVELS",
  };
  return map[normalized] || null;
}

function parseBoolean(value: string) {
  if (!value) return null;
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  if (["1", "true", "yes", "on", "公開", "はい"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "非公開", "いいえ"].includes(normalized)) return false;
  return null;
}

async function taxonomyId(kind: "university" | "subject" | "series", name: string) {
  if (!name) return null;
  const db = getDb();
  const table = kind === "university" ? universities : kind === "subject" ? subjects : series;
  const [byName] = await db.select({ id: table.id }).from(table).where(eq(table.name, name)).limit(1);
  if (byName) return byName.id;
  const taxonomySlug = slugify(name);
  const [bySlug] = await db.select({ id: table.id }).from(table).where(eq(table.slug, taxonomySlug)).limit(1);
  if (bySlug) return bySlug.id;
  const [created] = await db.insert(table).values({ name, slug: taxonomySlug }).returning({ id: table.id });
  return created.id;
}

async function materialSlug(title: string, id: string) {
  const db = getDb();
  const base = slugify(title);
  const [collision] = await db.select({ id: materials.id }).from(materials)
    .where(and(eq(materials.slug, base), ne(materials.id, id))).limit(1);
  return collision ? `${base}-${id.slice(0, 8)}` : base;
}

export async function importMaterialsCsv(csv: string, defaults: MaterialCsvDefaults): Promise<MaterialCsvImportResult> {
  const parsed = Papa.parse<CsvRow>(csv.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length && !parsed.data.length) throw new Error(`CSVを解析できません: ${parsed.errors[0].message}`);
  if (!parsed.meta.fields?.some((header) => aliases.title.map(normalizeHeader).includes(normalizeHeader(header)))) {
    throw new Error("「タイトル」列が見つかりません。テンプレートの見出しを使用してください。");
  }
  if (parsed.data.length > 500) throw new Error("一度に登録できる教材は500件までです。");

  const db = getDb();
  const result: MaterialCsvImportResult = { total: parsed.data.length, created: 0, updated: 0, skipped: 0, errors: [] };

  for (const [index, row] of parsed.data.entries()) {
    const rowNumber = index + 2;
    try {
      const title = field(row, aliases.title);
      if (!title) throw new Error("タイトルが空です");
      if (title.length > 200) throw new Error("タイトルは200文字以内にしてください");

      const rawAsin = field(row, aliases.asin);
      const asin = normalizeAsin(rawAsin);
      if (asin && !/^[A-Z0-9]{10}$/.test(asin)) throw new Error(`ASIN「${rawAsin}」の形式が正しくありません`);
      const formatValue = parseFormat(field(row, aliases.format), defaults.format);
      if (!formatValue) throw new Error("販売形式を認識できません");
      const rawDifficulty = field(row, aliases.difficulty);
      const difficultyValue = parseDifficulty(rawDifficulty);
      if (rawDifficulty && !difficultyValue) throw new Error(`難易度「${rawDifficulty}」を認識できません`);
      const rawPublished = field(row, aliases.isPublished);
      const publishedValue = parseBoolean(rawPublished);
      if (rawPublished && publishedValue === null) throw new Error(`公開状態「${rawPublished}」を認識できません`);
      const amazonUrl = field(row, aliases.amazonUrl);
      if (amazonUrl && !/^https:\/\//.test(amazonUrl)) throw new Error("Amazon URLは https:// から入力してください");

      let materialId: string | undefined;
      let editionByAsin: typeof materialEditions.$inferSelect | undefined;
      if (asin) {
        const [byAsin] = await db.select()
          .from(materialEditions).where(eq(materialEditions.asin, asin)).limit(1);
        editionByAsin = byAsin;
        materialId = byAsin?.materialId;
      }
      if (!materialId) {
        const [byTitle] = await db.select({ id: materials.id }).from(materials).where(eq(materials.title, title)).limit(1);
        materialId = byTitle?.id;
      }

      let editionForFormat: typeof materialEditions.$inferSelect | undefined;
      if (materialId && (asin || amazonUrl)) {
        [editionForFormat] = await db.select().from(materialEditions)
          .where(and(eq(materialEditions.materialId, materialId), eq(materialEditions.format, formatValue))).limit(1);
        if (!editionByAsin && editionForFormat?.asin && asin && editionForFormat.asin !== asin) {
          throw new Error(`${formatValue}形式には別のASINが登録済みです`);
        }
      }

      const university = field(row, aliases.university);
      const subject = field(row, aliases.subject);
      const seriesName = field(row, aliases.series);
      const [universityId, subjectId, seriesId] = await Promise.all([
        university ? taxonomyId("university", university) : null,
        subject ? taxonomyId("subject", subject) : null,
        seriesName ? taxonomyId("series", seriesName) : null,
      ]);

      const description = field(row, aliases.description);
      const problemStructure = field(row, aliases.problemStructure);
      if (description.length > 10_000) throw new Error("説明は10,000文字以内にしてください");
      if (problemStructure.length > 10_000) throw new Error("問題構成は10,000文字以内にしてください");
      let wasCreated = false;
      if (materialId) {
        const update: Partial<typeof materials.$inferInsert> = { title, updatedAt: new Date() };
        if (description) update.description = description;
        if (problemStructure) update.problemStructure = problemStructure;
        if (universityId) update.universityId = universityId;
        if (subjectId) update.subjectId = subjectId;
        if (seriesId) update.seriesId = seriesId;
        if (difficultyValue) update.difficulty = difficultyValue;
        if (publishedValue !== null) update.isPublished = publishedValue;
        await db.update(materials).set(update).where(eq(materials.id, materialId));
      } else {
        materialId = crypto.randomUUID();
        wasCreated = true;
        await db.insert(materials).values({
          id: materialId,
          title,
          slug: await materialSlug(title, materialId),
          description,
          problemStructure: problemStructure || null,
          universityId,
          subjectId,
          seriesId,
          difficulty: difficultyValue || "ALL_LEVELS",
          isPublished: publishedValue ?? defaults.isPublished,
        });
      }

      if (asin || amazonUrl) {
        const targetEdition = editionByAsin || editionForFormat;
        if (targetEdition) {
          await db.update(materialEditions).set({
            asin: asin || targetEdition.asin,
            amazonUrl: amazonUrl || targetEdition.amazonUrl,
            isActive: true,
            updatedAt: new Date(),
          }).where(eq(materialEditions.id, targetEdition.id));
        } else {
          await db.insert(materialEditions).values({ materialId, format: formatValue, asin: asin || null, amazonUrl: amazonUrl || null });
        }
      }

      await db.insert(changeLogs).values({
        entityType: "material",
        entityId: materialId,
        action: "csv_imported",
        snapshot: { title, asin: asin || null, row: rowNumber },
      });
      if (wasCreated) result.created++;
      else result.updated++;
    } catch (error) {
      result.skipped++;
      const message = error instanceof Error ? error.message : "登録できませんでした";
      if (result.errors.length < 10) result.errors.push(`${rowNumber}行目: ${message}`);
    }
  }
  return result;
}
