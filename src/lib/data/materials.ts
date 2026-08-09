import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, ne, or } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { materialEditions, materials, series, subjects, universities } from "@/lib/db/schema";

export type CatalogFilters = {
  q?: string;
  university?: string;
  subject?: string;
  series?: string;
  page?: number;
  pageSize?: number;
};

function baseMaterialSelect() {
  return {
    id: materials.id,
    title: materials.title,
    slug: materials.slug,
    description: materials.description,
    problemStructure: materials.problemStructure,
    difficulty: materials.difficulty,
    coverUrl: materials.coverUrl,
    samplePdfUrl: materials.samplePdfUrl,
    publicationDate: materials.publicationDate,
    productionStatus: materials.productionStatus,
    kdpStatus: materials.kdpStatus,
    isPublished: materials.isPublished,
    isFeatured: materials.isFeatured,
    notes: materials.notes,
    createdAt: materials.createdAt,
    updatedAt: materials.updatedAt,
    universityId: materials.universityId,
    universityName: universities.name,
    universitySlug: universities.slug,
    subjectId: materials.subjectId,
    subjectName: subjects.name,
    subjectSlug: subjects.slug,
    seriesId: materials.seriesId,
    seriesName: series.name,
    seriesSlug: series.slug,
  };
}

function materialConditions(filters: CatalogFilters, publishedOnly = true) {
  const conditions = [];
  if (publishedOnly) conditions.push(eq(materials.isPublished, true));
  if (filters.q?.trim()) {
    const keyword = `%${filters.q.trim()}%`;
    conditions.push(or(
      ilike(materials.title, keyword),
      ilike(materials.description, keyword),
      ilike(materials.problemStructure, keyword),
    )!);
  }
  if (filters.university) conditions.push(eq(universities.slug, filters.university));
  if (filters.subject) conditions.push(eq(subjects.slug, filters.subject));
  if (filters.series) conditions.push(eq(series.slug, filters.series));
  return conditions;
}

export async function listPublishedMaterials(filters: CatalogFilters = {}) {
  const db = getDb();
  const pageSize = Math.min(Math.max(filters.pageSize || 24, 1), 60);
  const page = Math.max(filters.page || 1, 1);
  const conditions = materialConditions(filters);

  const [rows, [{ total }]] = await Promise.all([
    db.select(baseMaterialSelect())
      .from(materials)
      .leftJoin(universities, eq(materials.universityId, universities.id))
      .leftJoin(subjects, eq(materials.subjectId, subjects.id))
      .leftJoin(series, eq(materials.seriesId, series.id))
      .where(and(...conditions))
      .orderBy(desc(materials.publicationDate), desc(materials.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() })
      .from(materials)
      .leftJoin(universities, eq(materials.universityId, universities.id))
      .leftJoin(subjects, eq(materials.subjectId, subjects.id))
      .leftJoin(series, eq(materials.seriesId, series.id))
      .where(and(...conditions)),
  ]);

  const editions = rows.length
    ? await db.select().from(materialEditions).where(and(
        inArray(materialEditions.materialId, rows.map((row) => row.id)),
        eq(materialEditions.isActive, true),
      )).orderBy(asc(materialEditions.format))
    : [];

  return {
    items: rows.map((row) => ({ ...row, editions: editions.filter((edition) => edition.materialId === row.id) })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export const getPublishedMaterial = cache(async (slug: string) => {
  const db = getDb();
  const [item] = await db.select(baseMaterialSelect())
    .from(materials)
    .leftJoin(universities, eq(materials.universityId, universities.id))
    .leftJoin(subjects, eq(materials.subjectId, subjects.id))
    .leftJoin(series, eq(materials.seriesId, series.id))
    .where(and(eq(materials.slug, slug), eq(materials.isPublished, true)))
    .limit(1);
  if (!item) return null;
  const editions = await db.select().from(materialEditions)
    .where(and(eq(materialEditions.materialId, item.id), eq(materialEditions.isActive, true)))
    .orderBy(asc(materialEditions.format));
  return { ...item, editions };
});

export async function getRelatedMaterials(material: Awaited<ReturnType<typeof getPublishedMaterial>>, limit = 4) {
  if (!material) return [];
  const relationConditions = [];
  if (material.seriesId) relationConditions.push(eq(materials.seriesId, material.seriesId));
  if (material.subjectId) relationConditions.push(eq(materials.subjectId, material.subjectId));
  if (!relationConditions.length) return [];
  const db = getDb();
  return db.select(baseMaterialSelect())
    .from(materials)
    .leftJoin(universities, eq(materials.universityId, universities.id))
    .leftJoin(subjects, eq(materials.subjectId, subjects.id))
    .leftJoin(series, eq(materials.seriesId, series.id))
    .where(and(eq(materials.isPublished, true), ne(materials.id, material.id), or(...relationConditions)))
    .orderBy(desc(materials.publicationDate), desc(materials.createdAt))
    .limit(limit);
}

async function taxonomyWithCounts(
  table: typeof universities | typeof subjects | typeof series,
  foreignKey: typeof materials.universityId | typeof materials.subjectId | typeof materials.seriesId,
) {
  const db = getDb();
  return db.select({ id: table.id, name: table.name, slug: table.slug, count: count(materials.id) })
    .from(table)
    .leftJoin(materials, and(eq(foreignKey, table.id), eq(materials.isPublished, true)))
    .groupBy(table.id, table.name, table.slug)
    .orderBy(desc(count(materials.id)), asc(table.name));
}

export async function getTaxonomies() {
  const [universityList, subjectList, seriesList] = await Promise.all([
    taxonomyWithCounts(universities, materials.universityId),
    taxonomyWithCounts(subjects, materials.subjectId),
    taxonomyWithCounts(series, materials.seriesId),
  ]);
  return { universities: universityList, subjects: subjectList, series: seriesList };
}

export async function getHomeData() {
  const db = getDb();
  const [newest, featured, all, taxonomies] = await Promise.all([
    listPublishedMaterials({ pageSize: 4 }),
    db.select(baseMaterialSelect())
      .from(materials)
      .leftJoin(universities, eq(materials.universityId, universities.id))
      .leftJoin(subjects, eq(materials.subjectId, subjects.id))
      .leftJoin(series, eq(materials.seriesId, series.id))
      .where(and(eq(materials.isPublished, true), eq(materials.isFeatured, true)))
      .orderBy(desc(materials.updatedAt)).limit(4),
    listPublishedMaterials({ pageSize: 8 }),
    getTaxonomies(),
  ]);
  return { newest: newest.items, featured, all: all.items, total: all.total, ...taxonomies };
}

export async function listAdminMaterials() {
  const db = getDb();
  const rows = await db.select({ ...baseMaterialSelect(), editionCount: count(materialEditions.id) })
    .from(materials)
    .leftJoin(universities, eq(materials.universityId, universities.id))
    .leftJoin(subjects, eq(materials.subjectId, subjects.id))
    .leftJoin(series, eq(materials.seriesId, series.id))
    .leftJoin(materialEditions, eq(materialEditions.materialId, materials.id))
    .groupBy(materials.id, universities.id, subjects.id, series.id)
    .orderBy(desc(materials.updatedAt));
  return rows;
}

export async function getAdminMaterial(id: string) {
  const db = getDb();
  const [item] = await db.select(baseMaterialSelect())
    .from(materials)
    .leftJoin(universities, eq(materials.universityId, universities.id))
    .leftJoin(subjects, eq(materials.subjectId, subjects.id))
    .leftJoin(series, eq(materials.seriesId, series.id))
    .where(eq(materials.id, id)).limit(1);
  if (!item) return null;
  const editions = await db.select().from(materialEditions).where(eq(materialEditions.materialId, id));
  return { ...item, editions };
}

export async function allActiveEditions() {
  const db = getDb();
  return db.select({
    id: materialEditions.id,
    asin: materialEditions.asin,
    format: materialEditions.format,
    title: materials.title,
  }).from(materialEditions)
    .innerJoin(materials, eq(materialEditions.materialId, materials.id))
    .where(eq(materialEditions.isActive, true))
    .orderBy(asc(materials.title), asc(materialEditions.format));
}

export async function getPublicSlugs() {
  return getDb().select({ slug: materials.slug, updatedAt: materials.updatedAt })
    .from(materials).where(eq(materials.isPublished, true));
}

export async function findEditionForRedirect(id: string) {
  const [row] = await getDb().select({ id: materialEditions.id, amazonUrl: materialEditions.amazonUrl })
    .from(materialEditions)
    .innerJoin(materials, eq(materialEditions.materialId, materials.id))
    .where(and(eq(materialEditions.id, id), eq(materialEditions.isActive, true), eq(materials.isPublished, true)))
    .limit(1);
  return row || null;
}
