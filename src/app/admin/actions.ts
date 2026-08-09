"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { changeLogs, materials } from "@/lib/db/schema";
import { linkAsinToEdition } from "@/lib/services/csv-import";
import { importKdpCsv } from "@/lib/services/csv-import";
import { importMaterialsCsv } from "@/lib/services/material-csv-import";
import { saveMaterial } from "@/lib/services/material-service";
import { materialFromFormData, uuidSchema } from "@/lib/validators";

export async function saveMaterialAction(formData: FormData) {
  await requireAdmin();
  const parsed = materialFromFormData(formData);
  const id = String(formData.get("id") || "");
  const fallback = id ? `/admin/materials/${id}/edit` : "/admin/materials/new";
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "入力内容を確認してください。";
    redirect(`${fallback}?error=${encodeURIComponent(message)}`);
  }
  try {
    await saveMaterial(parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "教材を保存できませんでした。";
    redirect(`${fallback}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/admin/materials");
  redirect("/admin/materials?saved=1");
}

export async function linkAsinAction(formData: FormData) {
  await requireAdmin();
  const asin = String(formData.get("asin") || "");
  const edition = uuidSchema.safeParse(formData.get("editionId"));
  if (!edition.success) redirect("/admin/imports?error=" + encodeURIComponent("紐付け先を選択してください。"));
  try {
    await linkAsinToEdition(asin, edition.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "紐付けに失敗しました。";
    redirect(`/admin/imports?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/imports");
  redirect("/admin/imports?linked=1");
}

export async function processCsvImportAction(input: { blobUrl: string; filename: string }) {
  await requireAdmin();
  if (!input.filename.toLowerCase().endsWith(".csv")) return { ok: false as const, error: "CSVファイルを選択してください。" };
  try {
    const result = await importKdpCsv(input.blobUrl, input.filename);
    revalidatePath("/admin");
    revalidatePath("/admin/imports");
    return { ok: true as const, result };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "CSV取込に失敗しました。" };
  }
}

export async function importMaterialsCsvAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) {
    redirect("/admin/materials/import?error=" + encodeURIComponent("CSVファイルを選択してください。"));
  }
  if (file.size > 2 * 1024 * 1024) {
    redirect("/admin/materials/import?error=" + encodeURIComponent("CSVは2MB以下にしてください。"));
  }
  const format = String(formData.get("defaultFormat") || "OTHER");
  if (!(["KINDLE", "PAPERBACK", "HARDCOVER", "OTHER"] as const).includes(format as "KINDLE" | "PAPERBACK" | "HARDCOVER" | "OTHER")) {
    redirect("/admin/materials/import?error=" + encodeURIComponent("販売形式が正しくありません。"));
  }
  let result: Awaited<ReturnType<typeof importMaterialsCsv>>;
  try {
    const bytes = await file.arrayBuffer();
    let csv = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (csv.includes("�")) csv = new TextDecoder("shift_jis").decode(bytes);
    result = await importMaterialsCsv(csv, {
      format: format as "KINDLE" | "PAPERBACK" | "HARDCOVER" | "OTHER",
      isPublished: formData.get("defaultPublished") === "on",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "教材CSVを取り込めませんでした。";
    redirect(`/admin/materials/import?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/admin/materials");
  const query = new URLSearchParams({
    imported: "1",
    total: String(result.total),
    created: String(result.created),
    updated: String(result.updated),
    skipped: String(result.skipped),
  });
  if (result.errors.length) query.set("details", result.errors.join("\n"));
  redirect(`/admin/materials/import?${query}`);
}

export async function deleteMaterialAction(formData: FormData) {
  await requireAdmin();
  const parsed = uuidSchema.safeParse(formData.get("id"));
  if (!parsed.success) redirect("/admin/materials?error=" + encodeURIComponent("教材IDが正しくありません。"));
  const db = getDb();
  const [item] = await db.select({ id: materials.id, title: materials.title }).from(materials)
    .where(eq(materials.id, parsed.data)).limit(1);
  if (!item) redirect("/admin/materials?error=" + encodeURIComponent("教材が見つかりません。"));
  await db.insert(changeLogs).values({
    entityType: "material",
    entityId: item.id,
    action: "deleted",
    snapshot: { title: item.title },
  });
  await db.delete(materials).where(eq(materials.id, item.id));
  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/admin/materials");
  redirect("/admin/materials?deleted=1");
}
