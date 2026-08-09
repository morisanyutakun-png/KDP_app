import Link from "next/link";
import { importMaterialsCsvAction } from "@/app/admin/actions";
import { AdminPageHeader } from "@/components/admin-ui";
import { formatLabels, formatValues } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Query = {
  imported?: string;
  total?: string;
  created?: string;
  updated?: string;
  skipped?: string;
  details?: string;
  error?: string;
};

export default async function MaterialImportPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  return <>
    <AdminPageHeader
      eyebrow="MATERIAL CSV"
      title="教材CSV一括登録"
      description="タイトルとASINをまとめて追加・更新できます。既存ASINは重複登録せず更新します。"
      action={<Link href="/admin/materials" className="btn-secondary">教材一覧へ戻る</Link>}
    />
    <div className="max-w-4xl p-5 sm:p-8">
      {query.error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{query.error}</div>}
      {query.imported && <div className="mb-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal">
        <p className="font-black">CSV取込が完了しました。</p>
        <p className="mt-1">全{query.total || 0}件 / 新規{query.created || 0}件 / 更新{query.updated || 0}件 / スキップ{query.skipped || 0}件</p>
        {query.details && <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-white/70 p-3 text-xs text-red-700">{query.details}</pre>}
      </div>}

      <form action={importMaterialsCsvAction} className="card p-5 sm:p-7">
        <h2 className="text-lg font-black text-navy">CSVファイル</h2>
        <p className="mt-2 text-sm leading-6 text-muted">UTF-8またはShift-JISのCSV、最大2MB・500件まで。タイトル列は必須です。ASINは「ASIN: B0...」の形式でも取り込めます。</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label" htmlFor="file">教材CSV *</label><input className="input file:mr-4 file:rounded-lg file:border-0 file:bg-navy file:px-3 file:py-2 file:text-xs file:font-bold file:text-white" id="file" name="file" type="file" accept=".csv,text/csv" required /></div>
          <div><label className="label" htmlFor="defaultFormat">CSVに形式がない場合</label><select className="input" id="defaultFormat" name="defaultFormat" defaultValue="OTHER">{formatValues.map((format) => <option key={format} value={format}>{formatLabels[format]}</option>)}</select></div>
          <label className="flex items-center gap-3 self-end rounded-xl border border-line p-3.5 text-sm font-bold text-navy"><input className="size-4 accent-teal" type="checkbox" name="defaultPublished" />新規教材を公開する</label>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a className="text-sm font-bold text-brand-blue hover:underline" href="/material-import-template.csv" download>CSVテンプレートをダウンロード</a>
          <button className="btn-primary" type="submit">CSVを取り込む</button>
        </div>
      </form>

      <section className="card mt-6 p-5 sm:p-7">
        <h2 className="font-black text-navy">対応している列</h2>
        <p className="mt-3 text-sm leading-7 text-muted">タイトル、ASIN、問題構成、説明、大学、科目、シリーズ、難易度、販売形式、Amazon URL、価格、公開。空欄は既存データを上書きしません。ASIN未登録の行はタイトルが一致すれば既存教材を更新します。</p>
      </section>
    </div>
  </>;
}
