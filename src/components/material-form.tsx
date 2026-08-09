import Link from "next/link";
import { saveMaterialAction } from "@/app/admin/actions";
import { FileUploadField } from "@/components/file-upload-field";
import {
  difficultyLabels,
  difficultyValues,
  formatLabels,
  formatValues,
  kdpStatusLabels,
  kdpStatusValues,
  productionStatusLabels,
  productionStatusValues,
} from "@/lib/constants";
import type { getAdminMaterial } from "@/lib/data/materials";

type AdminMaterial = NonNullable<Awaited<ReturnType<typeof getAdminMaterial>>>;

export function MaterialForm({ material, error }: { material?: AdminMaterial; error?: string }) {
  return <form action={saveMaterialAction} className="space-y-6">
    {material && <input type="hidden" name="id" value={material.id} />}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    <section className="card p-5 sm:p-6"><h2 className="text-lg font-black text-navy">基本情報</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><label className="label" htmlFor="title">タイトル *</label><input className="input" id="title" name="title" defaultValue={material?.title} required maxLength={200} /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="slug">公開URLスラッグ</label><input className="input" id="slug" name="slug" defaultValue={material?.slug} placeholder="空欄ならタイトルから自動生成" /><p className="mt-1 text-xs text-muted">日本語も使用できます。変更すると公開URLが変わります。</p></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="description">説明 *</label><textarea className="input min-h-40 resize-y" id="description" name="description" defaultValue={material?.description} required maxLength={10000} /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="problemStructure">問題構成</label><textarea className="input min-h-28 resize-y" id="problemStructure" name="problemStructure" defaultValue={material?.problemStructure || ""} maxLength={10000} placeholder="例: 大問6題、各年度の出題分野など" /></div>
      <div><label className="label" htmlFor="university">大学</label><input className="input" id="university" name="university" defaultValue={material?.universityName || ""} placeholder="入力すると分類を自動作成" /></div>
      <div><label className="label" htmlFor="subject">科目</label><input className="input" id="subject" name="subject" defaultValue={material?.subjectName || ""} placeholder="例: 統計学" /></div>
      <div><label className="label" htmlFor="series">シリーズ</label><input className="input" id="series" name="series" defaultValue={material?.seriesName || ""} placeholder="例: 基礎演習シリーズ" /></div>
      <div><label className="label" htmlFor="difficulty">難易度</label><select className="input" id="difficulty" name="difficulty" defaultValue={material?.difficulty || "ALL_LEVELS"}>{difficultyValues.map((value) => <option key={value} value={value}>{difficultyLabels[value]}</option>)}</select></div>
      <div><label className="label" htmlFor="publicationDate">出版日</label><input className="input" id="publicationDate" name="publicationDate" type="date" defaultValue={material?.publicationDate || ""} /></div>
    </div></section>

    <section className="card p-5 sm:p-6"><h2 className="text-lg font-black text-navy">画像・ファイル</h2><p className="mt-1 text-xs text-muted">Vercel Blobへブラウザから直接アップロードします。</p><div className="mt-5 grid gap-5 sm:grid-cols-2"><FileUploadField name="coverUrl" kind="cover" label="表紙画像（10MBまで）" accept="image/jpeg,image/png,image/webp,image/avif" initialUrl={material?.coverUrl} /><FileUploadField name="samplePdfUrl" kind="sample" label="サンプルPDF（50MBまで）" accept="application/pdf" initialUrl={material?.samplePdfUrl} /></div></section>

    <section className="card p-5 sm:p-6"><h2 className="text-lg font-black text-navy">制作・公開状態</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><label className="label" htmlFor="productionStatus">制作状況</label><select className="input" id="productionStatus" name="productionStatus" defaultValue={material?.productionStatus || "PLANNING"}>{productionStatusValues.map((value) => <option key={value} value={value}>{productionStatusLabels[value]}</option>)}</select></div><div><label className="label" htmlFor="kdpStatus">教材全体のKDP状態</label><select className="input" id="kdpStatus" name="kdpStatus" defaultValue={material?.kdpStatus || "DRAFT"}>{kdpStatusValues.map((value) => <option key={value} value={value}>{kdpStatusLabels[value]}</option>)}</select></div><label className="flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-bold text-navy"><input className="size-4 accent-teal" type="checkbox" name="isPublished" defaultChecked={material?.isPublished} />公開カタログに表示</label><label className="flex items-center gap-3 rounded-xl border border-line p-4 text-sm font-bold text-navy"><input className="size-4 accent-teal" type="checkbox" name="isFeatured" defaultChecked={material?.isFeatured} />注目教材として表示</label></div></section>

    <section className="card p-5 sm:p-6"><h2 className="text-lg font-black text-navy">販売形式</h2><p className="mt-1 text-xs text-muted">ASINは売上CSVとの自動紐付けに使用します。Amazon URLが空の場合、公開ページに購入ボタンは表示されません。</p><div className="mt-5 space-y-4">{formatValues.map((format) => { const edition = material?.editions.find((item) => item.format === format); return <fieldset key={format} className="rounded-2xl border border-line p-4"><legend className="px-2 font-black text-navy">{formatLabels[format]}</legend><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div><label className="label" htmlFor={`${format}-asin`}>ASIN</label><input className="input" id={`${format}-asin`} name={`edition.${format}.asin`} defaultValue={edition?.asin || ""} /></div><div><label className="label" htmlFor={`${format}-isbn`}>ISBN</label><input className="input" id={`${format}-isbn`} name={`edition.${format}.isbn`} defaultValue={edition?.isbn || ""} /></div><div className="md:col-span-2"><label className="label" htmlFor={`${format}-url`}>Amazon URL</label><input className="input" id={`${format}-url`} name={`edition.${format}.amazonUrl`} type="url" placeholder="https://..." defaultValue={edition?.amazonUrl || ""} /></div><div><label className="label" htmlFor={`${format}-kdp`}>KDP状態</label><select className="input" id={`${format}-kdp`} name={`edition.${format}.kdpStatus`} defaultValue={edition?.kdpStatus || "DRAFT"}>{kdpStatusValues.map((value) => <option key={value} value={value}>{kdpStatusLabels[value]}</option>)}</select></div><label className="flex items-center gap-2 self-end pb-3 text-sm font-bold text-navy"><input className="size-4 accent-teal" type="checkbox" name={`edition.${format}.isActive`} defaultChecked={edition?.isActive ?? true} />有効な販売形式</label></div></fieldset>; })}</div></section>

    <section className="card p-5 sm:p-6"><label className="label" htmlFor="notes">管理メモ（非公開）</label><textarea className="input min-h-32 resize-y" id="notes" name="notes" defaultValue={material?.notes || ""} maxLength={20000} /></section>
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href="/admin/materials" className="btn-secondary">キャンセル</Link><button type="submit" className="btn-primary">教材を保存</button></div>
  </form>;
}
