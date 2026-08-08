import "server-only";

import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import Papa from "papaparse";
import { getDb } from "@/lib/db";
import { materialEditions, salesImports, salesRecords } from "@/lib/db/schema";

const aliases = {
  asin: ["asin", "amazonstandardidentificationnumber"],
  saleDate: ["royaltydate", "saledate", "transactiondate", "orderdate", "date", "売上日", "注文日", "ロイヤリティ日"],
  units: ["netunitssold", "unitssold", "units", "quantity", "販売冊数", "純販売数", "数量"],
  royalty: ["royalty", "royaltyearned", "netroyalty", "ロイヤリティ", "獲得ロイヤリティ"],
  currency: ["currency", "通貨"],
  marketplace: ["marketplace", "store", "マーケットプレイス", "ストア"],
} as const;

function canonical(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/^\ufeff/, "").replace(/[^\p{Letter}\p{Number}]/gu, "");
}

function hash(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function detectMapping(fields: string[]) {
  const normalized = new Map(fields.map((field) => [canonical(field), field]));
  const mapping: Record<string, string> = {};
  for (const [target, options] of Object.entries(aliases)) {
    const found = options.map(canonical).find((name) => normalized.has(name));
    if (found) mapping[target] = normalized.get(found)!;
  }
  return mapping;
}

function parseDate(value: string) {
  const clean = value.trim();
  let match = clean.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  const date = new Date(clean);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function numeric(value: string | undefined) {
  if (!value) return 0;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function stableRow(row: Record<string, string>) {
  return Object.entries(row)
    .map(([key, value]) => [canonical(key), String(value ?? "").trim()] as const)
    .sort(([a], [b]) => a.localeCompare(b));
}

function assertBlobUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname.endsWith("blob.vercel-storage.com")) {
    throw new Error("Vercel BlobのURLではありません。");
  }
}

export async function importKdpCsv(blobUrl: string, originalFilename: string) {
  assertBlobUrl(blobUrl);
  const response = await fetch(blobUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("アップロード済みCSVを取得できませんでした。");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 50 * 1024 * 1024) throw new Error("CSVは50MB以下にしてください。");
  const fileHash = hash(bytes);
  const db = getDb();
  const [duplicate] = await db.select({ id: salesImports.id }).from(salesImports)
    .where(eq(salesImports.fileHash, fileHash)).limit(1);
  if (duplicate) return { duplicate: true, importId: duplicate.id };

  const [record] = await db.insert(salesImports).values({ originalFilename, blobUrl, fileHash })
    .onConflictDoNothing({ target: salesImports.fileHash }).returning();
  if (!record) {
    const [concurrent] = await db.select({ id: salesImports.id }).from(salesImports)
      .where(eq(salesImports.fileHash, fileHash)).limit(1);
    return { duplicate: true, importId: concurrent.id };
  }
  try {
    const parsed = Papa.parse<Record<string, string>>(bytes.toString("utf8"), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.replace(/^\ufeff/, "").trim(),
    });
    if (parsed.errors.length && !parsed.data.length) throw new Error(parsed.errors[0].message);
    const mapping = detectMapping(parsed.meta.fields || []);
    if (!mapping.saleDate || !mapping.units) {
      throw new Error("日付または販売冊数の列を特定できません。READMEの対応列名を確認してください。");
    }

    const editions = await db.select({ id: materialEditions.id, asin: materialEditions.asin }).from(materialEditions);
    const editionByAsin = new Map(editions.filter((row) => row.asin).map((row) => [row.asin!.toUpperCase(), row.id]));
    let importedRows = 0;
    let duplicateRows = 0;
    let unmatchedRows = 0;
    const occurrences = new Map<string, number>();

    for (const row of parsed.data) {
      const saleDate = parseDate(row[mapping.saleDate] || "");
      if (!saleDate) continue;
      const asin = mapping.asin ? (row[mapping.asin] || "").trim().toUpperCase() || null : null;
      const editionId = asin ? editionByAsin.get(asin) || null : null;
      const stable = JSON.stringify(stableRow(row));
      const occurrence = (occurrences.get(stable) || 0) + 1;
      occurrences.set(stable, occurrence);
      const rowHash = hash(`${stable}#${occurrence}`);
      const [inserted] = await db.insert(salesRecords).values({
        importId: record.id,
        editionId,
        asin,
        saleDate,
        units: Math.trunc(numeric(row[mapping.units])),
        royalty: mapping.royalty ? String(numeric(row[mapping.royalty]).toFixed(2)) : null,
        currency: mapping.currency ? (row[mapping.currency] || "").trim() || null : null,
        marketplace: mapping.marketplace ? (row[mapping.marketplace] || "").trim() || null : null,
        rowHash,
        rawData: row,
      }).onConflictDoNothing({ target: salesRecords.rowHash }).returning({ id: salesRecords.id });
      if (inserted) {
        importedRows += 1;
        if (!editionId) unmatchedRows += 1;
      } else {
        duplicateRows += 1;
      }
    }

    await db.update(salesImports).set({
      status: "COMPLETED",
      totalRows: parsed.data.length,
      importedRows,
      duplicateRows,
      unmatchedRows,
      columnMapping: mapping,
      completedAt: new Date(),
    }).where(eq(salesImports.id, record.id));
    return { duplicate: false, importId: record.id, importedRows, duplicateRows, unmatchedRows };
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV取込に失敗しました。";
    await db.update(salesImports).set({ status: "FAILED", errorMessage: message, completedAt: new Date() })
      .where(eq(salesImports.id, record.id));
    throw new Error(message);
  }
}

export async function linkAsinToEdition(asin: string, editionId: string) {
  const normalizedAsin = asin.trim().toUpperCase();
  if (!normalizedAsin) throw new Error("ASINが空です。");
  const db = getDb();
  const [edition] = await db.select().from(materialEditions).where(eq(materialEditions.id, editionId)).limit(1);
  if (!edition) throw new Error("販売形式が見つかりません。");
  const [used] = await db.select({ id: materialEditions.id }).from(materialEditions)
    .where(and(sql`upper(${materialEditions.asin}) = ${normalizedAsin}`, sql`${materialEditions.id} <> ${editionId}::uuid`)).limit(1);
  if (used) throw new Error("このASINは別の販売形式に登録済みです。");
  await db.update(materialEditions).set({ asin: normalizedAsin, updatedAt: new Date() }).where(eq(materialEditions.id, editionId));
  await db.update(salesRecords).set({ editionId }).where(and(
    isNull(salesRecords.editionId),
    sql`upper(${salesRecords.asin}) = ${normalizedAsin}`,
  ));
}
