import "server-only";

import { eq } from "drizzle-orm";
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
  price: ["価格", "price", "amazon価格", "amazonprice", "販売価格"],
  pageCount: ["ページ数", "頁数", "pagecount", "pages", "page_count"],
  printingCost: ["印刷価格", "印刷コスト", "製造コスト", "printingcost", "printing_cost", "manufacturingcost"],
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

/** ページ数・印刷価格のような正の整数列を読む。 */
function parseCount(value: string, label: string) {
  if (!value) return null;
  const normalized = value.replace(/[￥¥,\s]/g, "");
  const count = Number(normalized);
  if (!Number.isInteger(count) || count < 0) throw new Error(`${label}「${value}」の形式が正しくありません`);
  return count;
}

function parseBoolean(value: string) {
  if (!value) return null;
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  if (["1", "true", "yes", "on", "公開", "はい"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "非公開", "いいえ"].includes(normalized)) return false;
  return null;
}

/** 分類名からIDを引く。同じ名前が何度も出てくるので取込中はキャッシュする。 */
async function taxonomyId(kind: "university" | "subject" | "series", name: string, cache: Map<string, string>) {
  if (!name) return null;
  const cacheKey = `${kind}:${name}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const db = getDb();
  const table = kind === "university" ? universities : kind === "subject" ? subjects : series;
  const [byName] = await db.select({ id: table.id }).from(table).where(eq(table.name, name)).limit(1);
  if (byName) {
    cache.set(cacheKey, byName.id);
    return byName.id;
  }
  const taxonomySlug = slugify(name);
  const [bySlug] = await db.select({ id: table.id }).from(table).where(eq(table.slug, taxonomySlug)).limit(1);
  if (bySlug) {
    cache.set(cacheKey, bySlug.id);
    return bySlug.id;
  }
  const [created] = await db.insert(table).values({ name, slug: taxonomySlug }).returning({ id: table.id });
  cache.set(cacheKey, created.id);
  return created.id;
}

export async function importMaterialsCsv(csv: string, defaults: MaterialCsvDefaults): Promise<MaterialCsvImportResult> {
  const parsed = Papa.parse<CsvRow>(csv.replace(/^﻿/, ""), {
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

  // 既存データを最初に一括で読み込む。行ごとにDBへ問い合わせると数十件でもタイムアウトするため。
  const [existingMaterials, existingEditions] = await Promise.all([
    db.select({ id: materials.id, title: materials.title, slug: materials.slug }).from(materials),
    db.select().from(materialEditions),
  ]);
  const materialIdByTitle = new Map(existingMaterials.map((material) => [material.title, material.id]));
  const usedSlugs = new Set(existingMaterials.map((material) => material.slug));
  // 突き合わせに使う項目だけを持つ軽い形にしておくと、取込中に作った版も同じ型で覚えられる。
  type EditionRef = Pick<(typeof existingEditions)[number],
    "id" | "materialId" | "format" | "asin" | "amazonUrl" | "priceAmount" | "priceUpdatedAt" | "pageCount" | "printingCost">;
  const editionByAsin = new Map<string, EditionRef>(existingEditions.filter((edition) => edition.asin).map((edition) => [edition.asin!, edition]));
  const editionByMaterialFormat = new Map<string, EditionRef>(existingEditions.map((edition) => [`${edition.materialId}:${edition.format}`, edition]));
  const taxonomyCache = new Map<string, string>();

  type Write = Parameters<typeof db.batch>[0][number];
  const writes: Write[] = [];

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
      const rawPrice = field(row, aliases.price);
      const normalizedPrice = rawPrice.replace(/[￥¥,\s]/g, "");
      const priceAmount = normalizedPrice ? Number(normalizedPrice) : null;
      if (priceAmount !== null && (!Number.isInteger(priceAmount) || priceAmount < 0)) throw new Error(`価格「${rawPrice}」の形式が正しくありません`);
      const pageCount = parseCount(field(row, aliases.pageCount), "ページ数");
      const printingCost = parseCount(field(row, aliases.printingCost), "印刷価格");

      const editionByAsinHit = asin ? editionByAsin.get(asin) : undefined;
      let materialId = editionByAsinHit?.materialId || materialIdByTitle.get(title);

      const editionForFormat = materialId ? editionByMaterialFormat.get(`${materialId}:${formatValue}`) : undefined;
      if (!editionByAsinHit && editionForFormat?.asin && asin && editionForFormat.asin !== asin) {
        throw new Error(`${formatValue}形式には別のASINが登録済みです`);
      }

      const university = field(row, aliases.university);
      const subject = field(row, aliases.subject);
      const seriesName = field(row, aliases.series);
      const universityId = university ? await taxonomyId("university", university, taxonomyCache) : null;
      const subjectId = subject ? await taxonomyId("subject", subject, taxonomyCache) : null;
      const seriesId = seriesName ? await taxonomyId("series", seriesName, taxonomyCache) : null;

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
        writes.push(db.update(materials).set(update).where(eq(materials.id, materialId)));
        materialIdByTitle.set(title, materialId);
      } else {
        materialId = crypto.randomUUID();
        wasCreated = true;
        // slugの重複判定も読み込み済みの一覧で行う。
        const base = slugify(title);
        const slug = usedSlugs.has(base) ? `${base}-${materialId.slice(0, 8)}` : base;
        usedSlugs.add(slug);
        materialIdByTitle.set(title, materialId);
        writes.push(db.insert(materials).values({
          id: materialId,
          title,
          slug,
          description,
          problemStructure: problemStructure || null,
          universityId,
          subjectId,
          seriesId,
          difficulty: difficultyValue || "ALL_LEVELS",
          isPublished: publishedValue ?? defaults.isPublished,
        }));
      }

      if (asin || amazonUrl || priceAmount !== null || pageCount !== null || printingCost !== null) {
        const targetEdition = editionByAsinHit || editionForFormat;
        if (targetEdition) {
          writes.push(db.update(materialEditions).set({
            asin: asin || targetEdition.asin,
            amazonUrl: amazonUrl || targetEdition.amazonUrl,
            priceAmount: priceAmount ?? targetEdition.priceAmount,
            priceCurrency: "JPY",
            priceUpdatedAt: priceAmount === null ? targetEdition.priceUpdatedAt : new Date(),
            pageCount: pageCount ?? targetEdition.pageCount,
            printingCost: printingCost ?? targetEdition.printingCost,
            isActive: true,
            updatedAt: new Date(),
          }).where(eq(materialEditions.id, targetEdition.id)));
        } else {
          const edition = {
            id: crypto.randomUUID(),
            materialId,
            format: formatValue,
            asin: asin || null,
            amazonUrl: amazonUrl || null,
            priceAmount,
            priceCurrency: "JPY",
            priceUpdatedAt: priceAmount === null ? null : new Date(),
            pageCount,
            printingCost,
          };
          writes.push(db.insert(materialEditions).values(edition));
          // 同じCSV内に同じASINや形式の行が続いても取り違えないよう、登録済みとして覚えておく。
          if (asin) editionByAsin.set(asin, edition);
          editionByMaterialFormat.set(`${materialId}:${formatValue}`, edition);
        }
      }

      writes.push(db.insert(changeLogs).values({
        entityType: "material",
        entityId: materialId,
        action: "csv_imported",
        snapshot: { title, asin: asin || null, row: rowNumber },
      }));
      if (wasCreated) result.created++;
      else result.updated++;
    } catch (error) {
      result.skipped++;
      const message = error instanceof Error ? error.message : "登録できませんでした";
      if (result.errors.length < 10) result.errors.push(`${rowNumber}行目: ${message}`);
    }
  }

  // まとめて送る。1件ずつawaitすると往復回数が行数×数回になり、実行時間の上限に掛かる。
  for (let start = 0; start < writes.length; start += 40) {
    const chunk = writes.slice(start, start + 40) as [Write, ...Write[]];
    await db.batch(chunk);
  }
  return result;
}
