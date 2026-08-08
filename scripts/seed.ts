import { neon } from "@neondatabase/serverless";
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL を設定してください。");
  const db = drizzle(neon(url), { schema });

  const [university] = await db.insert(schema.universities).values({ name: "サンプル大学", slug: "sample-university" })
    .onConflictDoUpdate({ target: schema.universities.slug, set: { name: "サンプル大学", updatedAt: new Date() } }).returning();
  const [subject] = await db.insert(schema.subjects).values({ name: "サンプル科目", slug: "sample-subject" })
    .onConflictDoUpdate({ target: schema.subjects.slug, set: { name: "サンプル科目", updatedAt: new Date() } }).returning();
  const [bookSeries] = await db.insert(schema.series).values({ name: "サンプルシリーズ", slug: "sample-series", description: "動作確認用の分類です。" })
    .onConflictDoUpdate({ target: schema.series.slug, set: { name: "サンプルシリーズ", updatedAt: new Date() } }).returning();

  const [existing] = await db.select({ id: schema.materials.id }).from(schema.materials).where(eq(schema.materials.slug, "sample-material")).limit(1);
  if (!existing) {
    await db.insert(schema.materials).values({
      title: "サンプル教材",
      slug: "sample-material",
      description: "画面と検索動作を確認するためのサンプル教材です。実際の教材情報に置き換えてください。",
      universityId: university.id,
      subjectId: subject.id,
      seriesId: bookSeries.id,
      difficulty: "BEGINNER",
      productionStatus: "PUBLISHED",
      kdpStatus: "LIVE",
      isPublished: true,
      isFeatured: true,
    });
  }
  console.log("Sample data seeded. ASIN・ISBN・Amazon URL・価格・売上は追加していません。");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
