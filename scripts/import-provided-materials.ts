import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { and, eq, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";
import { slugify } from "../src/lib/utils";

const entries = [
  ["合格答案をつくる 阪大理系数学 2027", "B0HBRD9C67", "阪大", "数学"],
  ["合格答案をつくる 名大数学 2027", "B0HBB92D4W", "名大", "数学"],
  ["合格答案をつくる 名大理系数学 2027 Vol.2", "B0HBJJJLZC", "名大", "数学"],
  ["合格答案をつくる 東北大理系数学 2027 Vol.1", "B0HBQJZGZ1", "東北大", "数学"],
  ["合格答案をつくる 東京科学大学（旧東工大）理系数学 2027", "B0HBJ9B611", "東京科学大学（旧東工大）", "数学"],
  ["合格答案をつくる 埼玉数学 2027", "B0HBVWYTQN", "埼玉", "数学"],
  ["合格答案をつくる 神戸大理系数学 2027", "B0HBQC238T", "神戸大", "数学"],
  ["合格答案をつくる 名工大数学 2027", "B0HBPCCZ2H", "名工大", "数学"],
  ["合格答案をつくる 早稲田人科数学 2027", "B0HBX7CP8T", "早稲田人科", "数学"],
  ["合格答案をつくる 早稲田理工数学 2027", "B0HBVPZ413", "早稲田理工", "数学"],
  ["合格答案をつくる 京大理系数学 2027", "B0HCKZFG2Z", "京大", "数学"],
  ["合格答案をつくる 東大理系数学 2027", "B0HCKS2FVN", "東大", "数学"],
  ["合格答案をつくる 九大理系数学 2027", "B0HCKX933K", "九大", "数学"],
  ["合格答案をつくる 広島大理系数学 2027", "B0HCKNQTPH", "広島大", "数学"],
  ["合格答案をつくる 千葉大数学 2027", "B0HCL22WBH", "千葉大", "数学"],
  ["合格答案をつくる 筑波大数学 2027", "B0HCKYQPL6", "筑波大", "数学"],
  ["合格答案をつくる 岡山大理系数学 2027", "B0HCTGKD1N", "岡山大", "数学"],
  ["合格答案をつくる 横国理系数学 2027", "B0HCL9TRXL", "横国", "数学"],
  ["合格答案をつくる 北大理系数学 2027", "B0HCPBLLSH", "北大", "数学"],
  ["合格答案をつくる 三重大数学 2027", "B0HCL7GPGX", "三重大", "数学"],
  ["合格答案をつくる 一橋数学 2027", "B0HBVGDG5F", "一橋", "数学"],
  ["合格答案をつくる 慶應理工数学 2027", "B0HBRL64VP", "慶應理工", "数学"],
  ["合格答案をつくる 名大英語 2027 Vol.2", "B0HBQ2MP8G", "名大", "英語"],
  ["合格答案をつくる 名大英語 2027", "B0H9Z5BC65", "名大", "英語"],
] as const;

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL を設定してください。");
  const db = drizzle(neon(url), { schema });

  async function taxonomyId(table: typeof schema.universities | typeof schema.subjects | typeof schema.series, name: string) {
    const [existing] = await db.select({ id: table.id }).from(table).where(eq(table.name, name)).limit(1);
    if (existing) return existing.id;
    const taxonomySlug = slugify(name);
    const [bySlug] = await db.select({ id: table.id }).from(table).where(eq(table.slug, taxonomySlug)).limit(1);
    if (bySlug) return bySlug.id;
    const [created] = await db.insert(table).values({ name, slug: taxonomySlug }).returning({ id: table.id });
    return created.id;
  }

  const seriesId = await taxonomyId(schema.series, "合格答案をつくる");
  let created = 0;
  let updated = 0;

  for (const [title, asin, university, subject] of entries) {
    const [universityId, subjectId] = await Promise.all([
      taxonomyId(schema.universities, university),
      taxonomyId(schema.subjects, subject),
    ]);
    const [edition] = await db.select({ id: schema.materialEditions.id, materialId: schema.materialEditions.materialId })
      .from(schema.materialEditions).where(eq(schema.materialEditions.asin, asin)).limit(1);
    const [titleMatch] = edition ? [] : await db.select({ id: schema.materials.id })
      .from(schema.materials).where(eq(schema.materials.title, title)).limit(1);
    let materialId = edition?.materialId || titleMatch?.id;

    if (materialId) {
      await db.update(schema.materials).set({ title, universityId, subjectId, seriesId, updatedAt: new Date() })
        .where(eq(schema.materials.id, materialId));
      updated++;
    } else {
      materialId = crypto.randomUUID();
      const baseSlug = slugify(title);
      const [collision] = await db.select({ id: schema.materials.id }).from(schema.materials)
        .where(and(eq(schema.materials.slug, baseSlug), ne(schema.materials.id, materialId))).limit(1);
      await db.insert(schema.materials).values({
        id: materialId,
        title,
        slug: collision ? `${baseSlug}-${materialId.slice(0, 8)}` : baseSlug,
        description: "",
        universityId,
        subjectId,
        seriesId,
        isPublished: false,
      });
      created++;
    }

    if (!edition) {
      const [otherEdition] = await db.select({ id: schema.materialEditions.id, asin: schema.materialEditions.asin })
        .from(schema.materialEditions)
        .where(and(eq(schema.materialEditions.materialId, materialId), eq(schema.materialEditions.format, "OTHER"))).limit(1);
      if (otherEdition?.asin && otherEdition.asin !== asin) {
        throw new Error(`「${title}」のその他形式には別のASINが登録されています。`);
      }
      if (otherEdition) {
        await db.update(schema.materialEditions).set({ asin, isActive: true, updatedAt: new Date() })
          .where(eq(schema.materialEditions.id, otherEdition.id));
      } else {
        await db.insert(schema.materialEditions).values({ materialId, format: "OTHER", asin });
      }
    }
  }

  console.log(`Provided material import completed: total=${entries.length} created=${created} updated=${updated}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
