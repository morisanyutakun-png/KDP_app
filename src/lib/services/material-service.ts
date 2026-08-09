import "server-only";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import {
  difficultyValues,
  formatValues,
  kdpStatusValues,
  productionStatusValues,
} from "@/lib/constants";
import { getDb } from "@/lib/db";
import { changeLogs, materialEditions, materials, series, subjects, universities } from "@/lib/db/schema";
import { slugify } from "@/lib/utils";

const optionalText = z.string().trim().max(500).optional().transform((value) => value || null);
const optionalUrl = z.string().trim().optional().refine(
  (value) => !value || /^https:\/\//.test(value),
  "URLは https:// から入力してください。",
).transform((value) => value || null);

export const materialInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "タイトルは必須です。").max(200),
  slug: z.string().trim().max(200).optional(),
  description: z.string().trim().min(1, "説明は必須です。").max(10_000),
  problemStructure: z.string().trim().max(10_000).optional().transform((value) => value || null),
  university: optionalText,
  subject: optionalText,
  series: optionalText,
  difficulty: z.enum(difficultyValues),
  coverUrl: optionalUrl,
  samplePdfUrl: optionalUrl,
  publicationDate: z.string().optional().refine(
    (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "出版日の形式が正しくありません。",
  ).transform((value) => value || null),
  productionStatus: z.enum(productionStatusValues),
  kdpStatus: z.enum(kdpStatusValues),
  notes: z.string().trim().max(20_000).optional().transform((value) => value || null),
  isPublished: z.boolean(),
  isFeatured: z.boolean(),
  editions: z.array(z.object({
    format: z.enum(formatValues),
    asin: z.string().trim().max(20).optional().transform((value) => value?.toUpperCase() || null),
    isbn: z.string().trim().max(32).optional().transform((value) => value || null),
    amazonUrl: optionalUrl,
    priceAmount: z.number().int().min(0).max(100_000_000).nullable(),
    priceCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
    kdpStatus: z.enum(kdpStatusValues),
    isActive: z.boolean(),
  })),
});

export type MaterialInput = z.infer<typeof materialInputSchema>;

async function getOrCreateTaxonomy(kind: "university" | "subject" | "series", name: string | null) {
  if (!name) return null;
  const db = getDb();
  const table = kind === "university" ? universities : kind === "subject" ? subjects : series;
  const [existing] = await db.select({ id: table.id }).from(table).where(eq(table.name, name)).limit(1);
  if (existing) return existing.id;
  const baseSlug = slugify(name);
  const [bySlug] = await db.select({ id: table.id }).from(table).where(eq(table.slug, baseSlug)).limit(1);
  if (bySlug) return bySlug.id;
  const [created] = await db.insert(table).values({ name, slug: baseSlug }).returning({ id: table.id });
  return created.id;
}

async function uniqueMaterialSlug(value: string, id: string) {
  const db = getDb();
  const base = slugify(value);
  const [collision] = await db.select({ id: materials.id }).from(materials)
    .where(and(eq(materials.slug, base), ne(materials.id, id))).limit(1);
  return collision ? `${base}-${id.slice(0, 8)}` : base;
}

export async function saveMaterial(input: MaterialInput) {
  const db = getDb();
  const id = input.id || crypto.randomUUID();
  const [universityId, subjectId, seriesId] = await Promise.all([
    getOrCreateTaxonomy("university", input.university),
    getOrCreateTaxonomy("subject", input.subject),
    getOrCreateTaxonomy("series", input.series),
  ]);
  const slug = await uniqueMaterialSlug(input.slug || input.title, id);
  const values = {
    title: input.title,
    slug,
    description: input.description,
    problemStructure: input.problemStructure,
    universityId,
    subjectId,
    seriesId,
    difficulty: input.difficulty,
    coverUrl: input.coverUrl,
    samplePdfUrl: input.samplePdfUrl,
    publicationDate: input.publicationDate,
    productionStatus: input.productionStatus,
    kdpStatus: input.kdpStatus,
    notes: input.notes,
    isPublished: input.isPublished,
    isFeatured: input.isFeatured,
    updatedAt: new Date(),
  };

  if (input.id) {
    await db.update(materials).set(values).where(eq(materials.id, id));
  } else {
    await db.insert(materials).values({ id, ...values });
  }

  const existingEditions = await db.select().from(materialEditions).where(eq(materialEditions.materialId, id));
  for (const edition of input.editions) {
    const existing = existingEditions.find((row) => row.format === edition.format);
    const editionValues = {
      asin: edition.asin,
      isbn: edition.isbn,
      amazonUrl: edition.amazonUrl,
      priceAmount: edition.priceAmount,
      priceCurrency: edition.priceCurrency,
      priceUpdatedAt: edition.priceAmount === null
        ? existing?.priceUpdatedAt || null
        : edition.priceAmount === existing?.priceAmount ? existing?.priceUpdatedAt : new Date(),
      kdpStatus: edition.kdpStatus,
      isActive: edition.isActive,
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(materialEditions).set(editionValues).where(eq(materialEditions.id, existing.id));
    } else if (edition.asin || edition.isbn || edition.amazonUrl || edition.priceAmount !== null) {
      await db.insert(materialEditions).values({ materialId: id, format: edition.format, ...editionValues });
    }
  }

  await db.insert(changeLogs).values({
    entityType: "material",
    entityId: id,
    action: input.id ? "updated" : "created",
    snapshot: { title: input.title, slug, productionStatus: input.productionStatus, kdpStatus: input.kdpStatus },
  });
  return { id, slug };
}
