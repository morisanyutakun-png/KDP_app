import { neon } from "@neondatabase/serverless";
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL を設定してください。");

  const db = drizzle(neon(url));
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Database migration completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
