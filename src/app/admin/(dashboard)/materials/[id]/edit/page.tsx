import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin-ui";
import { MaterialForm } from "@/components/material-form";
import { getAdminMaterial } from "@/lib/data/materials";

export const dynamic = "force-dynamic";

export default async function EditMaterialPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const material = await getAdminMaterial(id);
  if (!material) notFound();
  return <><AdminPageHeader eyebrow="EDIT MATERIAL" title="教材を編集" description={material.title} /><div className="mx-auto max-w-5xl p-5 sm:p-8"><MaterialForm material={material} error={query.error} /></div></>;
}
