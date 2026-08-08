"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { linkAsinToEdition } from "@/lib/services/csv-import";
import { importKdpCsv } from "@/lib/services/csv-import";
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
