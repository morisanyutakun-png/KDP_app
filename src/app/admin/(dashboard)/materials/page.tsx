import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-ui";
import { DeleteMaterialButton } from "@/components/delete-material-button";
import { kdpStatusLabels } from "@/lib/constants";
import { listAdminMaterials, type AdminMaterialSort } from "@/lib/data/materials";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Query = { saved?: string; deleted?: string; error?: string; sort?: string; dir?: string };

const columns = [
  { key: "title", label: "商品名", align: "left" },
  { key: "asin", label: "ASIN", align: "left", sortable: false },
  { key: "pages", label: "ページ数", align: "right" },
  { key: "cost", label: "印刷価格", align: "right" },
  { key: "price", label: "販売価格", align: "right" },
  { key: "royalty", label: "ロイヤリティ", align: "right" },
  { key: "updated", label: "更新日", align: "left" },
] as const;

const sortKeys: AdminMaterialSort[] = ["title", "pages", "cost", "price", "royalty", "updated"];

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const sort = sortKeys.includes(query.sort as AdminMaterialSort) ? query.sort as AdminMaterialSort : "updated";
  const direction = query.dir === "asc" ? "asc" : "desc";
  const items = await listAdminMaterials(sort, direction);

  const sortHref = (key: string) => {
    const params = new URLSearchParams();
    params.set("sort", key);
    // 同じ列をもう一度押したら昇順と降順を入れ替える。
    params.set("dir", sort === key && direction === "desc" ? "asc" : "desc");
    return `/admin/materials?${params.toString()}`;
  };

  const totals = items.reduce((sum, item) => ({
    pages: sum.pages + (item.pageCount || 0),
    cost: sum.cost + (item.printingCost || 0),
    royalty: sum.royalty + (item.royalty || 0),
    priced: sum.priced + (item.priceAmount === null ? 0 : 1),
  }), { pages: 0, cost: 0, royalty: 0, priced: 0 });

  return <>
    <AdminPageHeader
      eyebrow="出版管理"
      title="出版教材"
      description={`${items.length}件 · 総ページ ${formatNumber(totals.pages)}p · 印刷コスト計 ¥${formatNumber(totals.cost)} · 1冊あたりロイヤリティ計 ¥${formatNumber(totals.royalty)}`}
      action={<div className="flex flex-wrap gap-2"><Link className="btn-secondary" href="/admin/materials/import">CSV一括登録</Link><Link className="btn-primary" href="/admin/materials/new">＋ 新規教材</Link></div>}
    />
    <div className="p-4 sm:p-6">
      {query.saved && <div className="mb-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal">教材を保存しました。</div>}
      {query.deleted && <div className="mb-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal">教材を削除しました。</div>}
      {query.error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{query.error}</div>}

      {items.length ? <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="sheet w-full min-w-[980px]">
            <thead>
              <tr>
                <th className="w-10 text-right">#</th>
                {columns.map((column) => {
                  const active = sort === column.key;
                  return <th className={column.align === "right" ? "text-right" : "text-left"} key={column.key} scope="col">
                    {"sortable" in column && !column.sortable
                      ? column.label
                      : <Link className="sheet-sort" data-active={active} href={sortHref(column.key)}>
                        {column.label}
                        <span aria-hidden="true">{active ? (direction === "asc" ? "▲" : "▼") : "⇅"}</span>
                      </Link>}
                  </th>;
                })}
                <th className="w-20 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => <tr key={item.id}>
                <td className="text-right text-muted tabular-nums">{index + 1}</td>
                <td>
                  <Link className="font-semibold text-navy hover:underline" href={`/admin/materials/${item.id}/edit`}>{item.title}</Link>
                  {!item.isPublished && <span className="ml-2 border border-line px-1.5 py-0.5 text-[10px] font-bold text-muted">非公開</span>}
                  {item.kdpStatus !== "LIVE" && <span className="ml-2 text-[10px] text-muted">{kdpStatusLabels[item.kdpStatus]}</span>}
                </td>
                <td className="font-mono text-[11px] text-muted">
                  {item.amazonUrl && item.asins[0]
                    ? <a className="hover:text-navy hover:underline" href={item.amazonUrl} rel="noopener noreferrer" target="_blank">{item.asins[0]}</a>
                    : item.asins[0] || "—"}
                </td>
                <td className="text-right tabular-nums">{item.pageCount === null ? "—" : `${item.pageCount}p`}</td>
                <td className="text-right tabular-nums">{item.printingCost === null ? "—" : `¥${formatNumber(item.printingCost)}`}</td>
                <td className="text-right tabular-nums">{item.priceAmount === null ? "—" : `¥${formatNumber(item.priceAmount)}`}</td>
                <td className="text-right tabular-nums font-semibold text-navy">{item.royalty === null ? "—" : `¥${formatNumber(item.royalty)}`}</td>
                <td className="whitespace-nowrap text-muted">{formatDate(item.updatedAt)}</td>
                <td className="text-right"><div className="flex items-center justify-end gap-3">
                  <Link className="text-[11px] font-bold text-brand-blue hover:underline" href={`/admin/materials/${item.id}/edit`}>編集</Link>
                  <DeleteMaterialButton id={item.id} title={item.title} />
                </div></td>
              </tr>)}
            </tbody>
            <tfoot>
              <tr>
                <td />
                <td className="font-bold text-navy">合計 {items.length}件</td>
                <td />
                <td className="text-right tabular-nums font-bold text-navy">{formatNumber(totals.pages)}p</td>
                <td className="text-right tabular-nums font-bold text-navy">¥{formatNumber(totals.cost)}</td>
                <td />
                <td className="text-right tabular-nums font-bold text-navy">¥{formatNumber(totals.royalty)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div> : <div className="card grid min-h-64 place-items-center p-8 text-center">
        <div>
          <h2 className="font-bold text-navy">教材がまだありません</h2>
          <p className="mt-2 text-sm text-muted">個別登録またはCSV一括登録を使用してください。</p>
          <div className="mt-5 flex justify-center gap-2"><Link className="btn-secondary" href="/admin/materials/import">CSV一括登録</Link><Link className="btn-primary" href="/admin/materials/new">教材を登録</Link></div>
        </div>
      </div>}
    </div>
  </>;
}
