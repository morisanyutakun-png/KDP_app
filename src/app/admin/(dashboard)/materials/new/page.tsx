import { AdminPageHeader } from "@/components/admin-ui";
import { MaterialForm } from "@/components/material-form";

export default async function NewMaterialPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <><AdminPageHeader eyebrow="出版教材" title="教材を登録" description="基本情報、ファイル、販売形式を一つの画面で登録します。" /><div className="mx-auto max-w-5xl p-5 sm:p-8"><MaterialForm error={error} /></div></>;
}
