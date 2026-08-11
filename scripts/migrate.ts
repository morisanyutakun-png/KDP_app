import { neon } from "@neondatabase/serverless";
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_URL;
  // ビルド前段から呼ばれるため、接続情報がないローカルではスキップして先に進める。
  // ただしデプロイ環境で欠けている場合は、未適用のまま公開されないようビルドを止める。
  if (!url) {
    if (process.env.VERCEL) throw new Error("デプロイ環境に DATABASE_URL がありません。マイグレーションを適用できないため中断します。");
    console.warn("DATABASE_URL が未設定のため、マイグレーションをスキップしました。");
    return;
  }

  const db = drizzle(neon(url));
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Database migration completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
