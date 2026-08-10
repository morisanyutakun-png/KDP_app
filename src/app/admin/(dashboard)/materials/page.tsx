import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-ui";
import { DeleteMaterialButton } from "@/components/delete-material-button";
import { kdpStatusLabels, productionStatusLabels } from "@/lib/constants";
import { listAdminMaterials } from "@/lib/data/materials";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Query = { saved?: string; deleted?: string; error?: string };

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [items, query] = await Promise.all([listAdminMaterials(), searchParams]);
  return <>
    <AdminPageHeader
      eyebrow="出版管理"
      title="教材管理"
      description={`${items.length}件の教材を管理しています。`}
      action={<div className="flex flex-wrap gap-2"><Link className="btn-secondary" href="/admin/materials/import">CSV一括登録</Link><Link className="btn-primary" href="/admin/materials/new">＋ 新規教材</Link></div>}
    />
    <div className="p-5 sm:p-8">
      {query.saved && <div className="mb-5 rounded-md border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal">教材を保存しました。</div>}
      {query.deleted && <div className="mb-5 rounded-md border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal">教材を削除しました。</div>}
      {query.error && <div role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{query.error}</div>}
      <div className="card overflow-hidden">
        {items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-surface text-xs text-muted"><tr><th className="px-5 py-3 font-bold">教材</th><th className="px-4 py-3 font-bold">分類</th><th className="px-4 py-3 font-bold">制作状況</th><th className="px-4 py-3 font-bold">KDP</th><th className="px-4 py-3 font-bold">公開</th><th className="px-4 py-3 font-bold">更新日</th><th className="px-5 py-3" /></tr></thead>
          <tbody className="divide-y divide-line">{items.map((item) => <tr key={item.id} className="hover:bg-slate-50/60">
            <td className="px-5 py-4"><strong className="block max-w-xs truncate text-navy">{item.title}</strong><span className="mt-1 block text-xs text-muted">{item.asins.length ? `ASIN: ${item.asins.join(", ")}` : `販売形式 ${item.editionCount}`}</span></td>
            <td className="px-4 py-4 text-xs text-muted"><span className="block">{item.universityName || "大学未設定"}</span><span className="mt-1 block">{item.subjectName || "科目未設定"}</span></td>
            <td className="px-4 py-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-brand-blue">{productionStatusLabels[item.productionStatus]}</span></td>
            <td className="px-4 py-4 text-xs font-bold text-muted">{kdpStatusLabels[item.kdpStatus]}</td>
            <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.isPublished ? "bg-teal-50 text-teal" : "bg-slate-100 text-muted"}`}>{item.isPublished ? "公開中" : "非公開"}</span></td>
            <td className="px-4 py-4 text-xs text-muted">{formatDate(item.updatedAt)}</td>
            <td className="px-5 py-4"><div className="flex items-center justify-end gap-4"><Link className="text-xs font-bold text-brand-blue hover:underline" href={`/admin/materials/${item.id}/edit`}>編集</Link><DeleteMaterialButton id={item.id} title={item.title} /></div></td>
          </tr>)}</tbody>
        </table></div> : <div className="grid min-h-64 place-items-center p-8 text-center"><div><div className="mx-auto mb-4 grid size-14 place-items-center rounded-lg bg-surface text-2xl">▤</div><h2 className="font-bold text-navy">教材がまだありません</h2><p className="mt-2 text-sm text-muted">個別登録またはCSV一括登録を使用してください。</p><div className="mt-5 flex justify-center gap-2"><Link href="/admin/materials/import" className="btn-secondary">CSV一括登録</Link><Link href="/admin/materials/new" className="btn-primary">教材を登録</Link></div></div></div>}
      </div>
    </div>
  </>;
}
