import { linkAsinAction } from "@/app/admin/actions";
import { AdminPageHeader } from "@/components/admin-ui";
import { CsvImporter } from "@/components/csv-importer";
import { formatLabels } from "@/lib/constants";
import { getDashboardData } from "@/lib/data/dashboard";
import { allActiveEditions } from "@/lib/data/materials";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ error?: string; linked?: string }> }) {
  const [data, editions, query] = await Promise.all([getDashboardData(), allActiveEditions(), searchParams]);
  return <>
    <AdminPageHeader eyebrow="KDP CSV" title="CSV取込・ASIN紐付け" description="KDPレポートの原本を保管し、売上データを安全に取り込みます。" />
    <div className="space-y-7 p-5 sm:p-8">
      {query.error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{query.error}</div>}
      {query.linked && <div className="rounded-md border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal">ASINを紐付け、過去の未紐付け売上にも反映しました。</div>}
      <CsvImporter />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="card overflow-hidden"><div className="border-b border-line p-5"><h2 className="font-bold text-navy">取込履歴</h2><p className="mt-1 text-xs text-muted">同じファイルハッシュは再取込しません。</p></div>{data.recentImports.length ? <div className="divide-y divide-line">{data.recentImports.map((item) => <div key={item.id} className="p-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><a href={item.blobUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-bold text-brand-blue hover:underline">{item.originalFilename} ↗</a><p className="mt-1 text-xs text-muted">{formatDate(item.createdAt)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.status === "COMPLETED" ? "bg-teal-50 text-teal" : item.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-blue-50 text-brand-blue"}`}>{item.status}</span></div><div className="mt-3 flex flex-wrap gap-3 text-xs text-muted"><span>全 {formatNumber(item.totalRows)}</span><span className="text-teal">取込 {formatNumber(item.importedRows)}</span><span>重複 {formatNumber(item.duplicateRows)}</span><span className="text-brand-orange">未紐付け {formatNumber(item.unmatchedRows)}</span></div>{item.errorMessage && <p className="mt-2 text-xs text-red-600">{item.errorMessage}</p>}</div>)}</div> : <div className="p-10 text-center text-sm text-muted">取込履歴はまだありません</div>}</section>
        <section className="card overflow-hidden"><div className="border-b border-line p-5"><h2 className="font-bold text-navy">未登録ASIN</h2><p className="mt-1 text-xs text-muted">販売形式を選ぶと、過去の売上もまとめて紐付きます。</p></div>{data.unmatched.length ? <div className="divide-y divide-line">{data.unmatched.map((row) => <form action={linkAsinAction} key={row.asin} className="p-4"><input type="hidden" name="asin" value={row.asin!} /><div className="flex items-center justify-between"><strong className="text-sm text-navy">{row.asin}</strong><span className="text-xs text-muted">{row.rows}行 / {row.units}冊</span></div><div className="mt-3 flex gap-2"><select className="input min-w-0" name="editionId" required defaultValue=""><option value="" disabled>紐付け先を選択</option>{editions.map((edition) => <option key={edition.id} value={edition.id}>{edition.title} / {formatLabels[edition.format]}{edition.asin ? ` (${edition.asin})` : ""}</option>)}</select><button className="btn-secondary shrink-0" type="submit">紐付け</button></div></form>)}</div> : <div className="p-10 text-center text-sm text-muted">未登録ASINはありません</div>}</section>
      </div>
      <section className="card p-5 sm:p-6"><h2 className="font-bold text-navy">対応する列名</h2><p className="mt-2 text-sm leading-relaxed text-muted">日付と販売冊数は必須です。英語・日本語の代表的な列名に対応し、ASIN、ロイヤリティ、通貨、マーケットプレイスは存在する場合に取り込みます。列名の対応は解析層に集約しているため、KDPの形式変更時も局所的に変更できます。</p><div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-navy">{["Royalty Date / Sale Date / 日付", "Net Units Sold / Units / 販売冊数", "ASIN", "Royalty", "Currency", "Marketplace"].map((label) => <span key={label} className="rounded-lg bg-surface px-3 py-2">{label}</span>)}</div></section>
    </div>
  </>;
}
