import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";
import { verifiedAmazonProducts } from "./data/verified-amazon-products";

async function main() {
  loadEnvConfig(process.cwd());
  const databaseUrl = process.env.DATABASE_URL;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!databaseUrl) throw new Error("DATABASE_URL を設定してください。");
  if (!blobToken) throw new Error("BLOB_READ_WRITE_TOKEN を設定してください。");

  const db = drizzle(neon(databaseUrl), { schema });
  const checkedAt = new Date("2026-08-09T14:30:00+09:00");
  let updated = 0;

  for (const product of verifiedAmazonProducts) {
    const [edition] = await db.select({ id: schema.materialEditions.id, materialId: schema.materialEditions.materialId })
      .from(schema.materialEditions)
      .where(eq(schema.materialEditions.asin, product.asin))
      .limit(1);
    if (!edition) throw new Error(`ASIN ${product.asin} がDBに登録されていません。`);

    const coverResponse = await fetch(product.coverSource, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; KyozaiShelf/1.0)" },
    });
    if (!coverResponse.ok) throw new Error(`${product.asin} の表紙を取得できませんでした (${coverResponse.status})。`);
    const cover = await put(`covers/${product.asin}.jpg`, await coverResponse.arrayBuffer(), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31_536_000,
      contentType: "image/jpeg",
      token: blobToken,
    });

    await db.update(schema.materials).set({
      description: product.description,
      problemStructure: product.description,
      coverUrl: cover.url,
      productionStatus: "PUBLISHED",
      kdpStatus: "LIVE",
      isPublished: true,
      updatedAt: checkedAt,
    }).where(eq(schema.materials.id, edition.materialId));

    await db.update(schema.materialEditions).set({
      format: "PAPERBACK",
      amazonUrl: `https://www.amazon.co.jp/dp/${product.asin}`,
      amazonTitle: product.amazonTitle,
      priceAmount: product.price,
      priceCurrency: "JPY",
      priceUpdatedAt: checkedAt,
      kdpStatus: "LIVE",
      isActive: true,
      updatedAt: checkedAt,
    }).where(eq(schema.materialEditions.id, edition.id));

    await db.insert(schema.changeLogs).values({
      entityType: "material",
      entityId: edition.materialId,
      action: "amazon_verified",
      snapshot: {
        asin: product.asin,
        amazonTitle: product.amazonTitle,
        format: "PAPERBACK",
        priceAmount: product.price,
        priceCurrency: "JPY",
        checkedAt: checkedAt.toISOString(),
      },
    });
    updated++;
  }

  console.log(`Verified Amazon product sync completed: total=${verifiedAmazonProducts.length} updated=${updated}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
