import "server-only";

import { and, count, desc, eq, gte, isNull, sql, sum } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  amazonClicks,
  materialEditions,
  materials,
  salesImports,
  salesRecords,
  series,
  subjects,
  universities,
} from "@/lib/db/schema";

const monthKey = sql<string>`to_char(${salesRecords.saleDate}, 'YYYY-MM')`;

export async function getDashboardData() {
  const db = getDb();
  const currentMonth = new Date();
  currentMonth.setUTCDate(1);
  currentMonth.setUTCHours(0, 0, 0, 0);
  const monthStart = currentMonth.toISOString().slice(0, 10);

  const [monthRows, monthly, products, byUniversity, bySubject, bySeries, clicks, recentImports, unmatched] = await Promise.all([
    db.select({ units: sum(salesRecords.units) }).from(salesRecords).where(gte(salesRecords.saleDate, monthStart)),
    db.select({ label: monthKey, units: sum(salesRecords.units) })
      .from(salesRecords).groupBy(monthKey).orderBy(desc(monthKey)).limit(12),
    db.select({ label: materials.title, units: sum(salesRecords.units) })
      .from(salesRecords)
      .innerJoin(materialEditions, eq(salesRecords.editionId, materialEditions.id))
      .innerJoin(materials, eq(materialEditions.materialId, materials.id))
      .groupBy(materials.id, materials.title).orderBy(desc(sum(salesRecords.units))).limit(12),
    db.select({ label: universities.name, units: sum(salesRecords.units) })
      .from(salesRecords).innerJoin(materialEditions, eq(salesRecords.editionId, materialEditions.id))
      .innerJoin(materials, eq(materialEditions.materialId, materials.id))
      .innerJoin(universities, eq(materials.universityId, universities.id))
      .groupBy(universities.id, universities.name).orderBy(desc(sum(salesRecords.units))).limit(12),
    db.select({ label: subjects.name, units: sum(salesRecords.units) })
      .from(salesRecords).innerJoin(materialEditions, eq(salesRecords.editionId, materialEditions.id))
      .innerJoin(materials, eq(materialEditions.materialId, materials.id))
      .innerJoin(subjects, eq(materials.subjectId, subjects.id))
      .groupBy(subjects.id, subjects.name).orderBy(desc(sum(salesRecords.units))).limit(12),
    db.select({ label: series.name, units: sum(salesRecords.units) })
      .from(salesRecords).innerJoin(materialEditions, eq(salesRecords.editionId, materialEditions.id))
      .innerJoin(materials, eq(materialEditions.materialId, materials.id))
      .innerJoin(series, eq(materials.seriesId, series.id))
      .groupBy(series.id, series.name).orderBy(desc(sum(salesRecords.units))).limit(12),
    db.select({ label: materials.title, format: materialEditions.format, clicks: count(amazonClicks.id) })
      .from(materialEditions).innerJoin(materials, eq(materialEditions.materialId, materials.id))
      .leftJoin(amazonClicks, eq(amazonClicks.editionId, materialEditions.id))
      .groupBy(materialEditions.id, materials.title).orderBy(desc(count(amazonClicks.id))).limit(12),
    db.select().from(salesImports).orderBy(desc(salesImports.createdAt)).limit(5),
    db.select({ asin: salesRecords.asin, rows: count(), units: sum(salesRecords.units) })
      .from(salesRecords)
      .where(and(isNull(salesRecords.editionId), sql`${salesRecords.asin} is not null`))
      .groupBy(salesRecords.asin).orderBy(desc(count())).limit(50),
  ]);

  return {
    currentMonthUnits: Number(monthRows[0]?.units || 0),
    monthly: monthly.reverse().map((row) => ({ ...row, units: Number(row.units || 0) })),
    products: products.map((row) => ({ ...row, units: Number(row.units || 0) })),
    universities: byUniversity.map((row) => ({ ...row, units: Number(row.units || 0) })),
    subjects: bySubject.map((row) => ({ ...row, units: Number(row.units || 0) })),
    series: bySeries.map((row) => ({ ...row, units: Number(row.units || 0) })),
    clicks,
    recentImports,
    unmatched: unmatched.filter((row) => row.asin).map((row) => ({ ...row, rows: Number(row.rows), units: Number(row.units || 0) })),
  };
}

export async function recordAmazonClick(editionId: string) {
  await getDb().insert(amazonClicks).values({ editionId });
}
