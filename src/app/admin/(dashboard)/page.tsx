import Link from "next/link";
import { AdminPageHeader, MetricCard } from "@/components/admin-ui";
import { getAuthoringOverview } from "@/lib/data/authoring";
import { mockStatusLabels } from "@/lib/authoring-labels";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuthoringDashboardPage() {
  const data = await getAuthoringOverview();
  return <>
    <AdminPageHeader eyebrow="AUTHORING WORKBENCH" title="教材制作ホーム" description="問題を探し、配置し、そのまま印刷・書き出しまで進められます。" action={<div className="flex gap-2"><Link className="btn-secondary" href="/admin/problems/new">問題を登録</Link><Link className="btn-primary" href="/admin/mocks/new">＋ 模試を作成</Link></div>} />
    <div className="workbench space-y-7">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="登録問題" value={data.problemTotal} note="アーカイブを除く" /><MetricCard label="検証済み" value={data.verifiedTotal} note="紙面採用の候補" tone="teal" /><MetricCard label="未使用問題" value={data.unusedTotal} note="模試で未採用" tone="blue" /><MetricCard label="制作中の模試" value={data.mockTotal} note="完成・編集中を含む" tone="orange" /></div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-line p-5"><div><h2 className="font-black text-navy">最近の模試</h2><p className="mt-1 text-xs text-muted">続きからすぐ編集できます。</p></div><Link className="text-sm font-bold text-brand-blue" href="/admin/mocks">すべて表示 →</Link></div>{data.recentMocks.length ? <div className="divide-y divide-line">{data.recentMocks.map(({ exam, subjectName }) => <Link href={`/admin/mocks/${exam.id}`} key={exam.id} className="flex items-center justify-between gap-4 p-5 transition hover:bg-slate-50"><span className="min-w-0"><strong className="block truncate text-navy">{exam.title}</strong><span className="mt-1 block text-xs text-muted">{subjectName || "科目未設定"} · {exam.questionCount}問 · {exam.durationMinutes}分 · {formatDate(exam.updatedAt)}</span></span><span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-brand-blue">{mockStatusLabels[exam.status]}</span></Link>)}</div> : <div className="grid min-h-56 place-items-center p-8 text-center"><div><p className="font-bold text-navy">まだ模試がありません</p><Link className="btn-primary mt-4" href="/admin/mocks/new">最初の模試を作る</Link></div></div>}</section>
        <section className="card p-5"><h2 className="font-black text-navy">最短の制作フロー</h2><ol className="mt-5 space-y-4">{["問題をMarkdown＋TeXで登録", "条件で候補を絞り込む", "各大問へ問題を配置", "紙面を確認して印刷 / PDF保存", "Markdown / LaTeXを書き出す"].map((label, index) => <li key={label} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy text-xs font-black text-white">{index + 1}</span><span className="pt-1 text-sm font-semibold text-ink">{label}</span></li>)}</ol><div className="mt-6 grid gap-2"><Link className="btn-secondary" href="/admin/problems">Problem Bankを開く</Link><Link className="btn-secondary" href="/admin/templates">紙面テンプレートを設定</Link></div></section>
      </div>
      <section className="rounded-2xl border border-line bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-navy">既存のKDP管理機能</h2><p className="mt-1 text-sm text-muted">24教材の商品棚、売上CSV、Amazonクリック計測はそのまま利用できます。</p></div><Link className="btn-secondary" href="/admin/kdp">KDPダッシュボードへ</Link></div></section>
    </div>
  </>;
}
