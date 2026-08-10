import Link from "next/link";
import { AdminPageHeader, MetricCard } from "@/components/admin-ui";
import { getAuthoringOverview } from "@/lib/data/authoring";
import { mockStatusLabels } from "@/lib/authoring-labels";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const workLinks = [
  { href: "/admin/problems", title: "数学問題を探す・登録する", description: "分野や難易度から問題文を検索" },
  { href: "/admin/mocks/new", title: "新しい数学模試を作成する", description: "入力なしですぐに問題選択を開始" },
  { href: "/admin/templates", title: "テンプレートを管理する", description: "大問数、試験時間、紙面設定を保存" },
];

export default async function AuthoringDashboardPage() {
  const data = await getAuthoringOverview();
  return <>
    <AdminPageHeader
      eyebrow="数学予想問題集"
      title="数学模試の制作ホーム"
      description="数学問題を検索し、問題文を比較しながら模試を構成します。紙面確認は最後に行います。"
      action={<div className="flex gap-2"><Link className="btn-secondary" href="/admin/problems/new">数学問題を登録</Link><Link className="btn-primary" href="/admin/mocks/new">数学模試を作成</Link></div>}
    />
    <div className="workbench space-y-6">
      <section aria-label="登録状況" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="登録数学問題" value={data.problemTotal} note="アーカイブを除く" />
        <MetricCard label="検証済み" value={data.verifiedTotal} note="紙面採用の候補" />
        <MetricCard label="未使用問題" value={data.unusedTotal} note="模試で未採用" />
        <MetricCard label="制作中の模試" value={data.mockTotal} note="完成・編集中を含む" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div><h2 className="font-bold text-navy">最近の模試</h2><p className="mt-1 text-xs text-muted">最終更新日の新しい順</p></div>
            <Link className="text-sm font-semibold text-brand-blue hover:underline" href="/admin/mocks">一覧を見る</Link>
          </div>
          {data.recentMocks.length ? <div className="divide-y divide-line">{data.recentMocks.map(({ exam, subjectName }) => (
            <Link href={`/admin/mocks/${exam.id}`} key={exam.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50">
              <span className="min-w-0"><strong className="block truncate text-sm font-semibold text-navy">{exam.title}</strong><span className="mt-1 block text-xs text-muted">{subjectName || "科目未設定"} · {exam.questionCount}問 · {exam.durationMinutes}分 · {formatDate(exam.updatedAt)}</span></span>
              <span className="shrink-0 border border-line bg-white px-2 py-1 text-xs text-muted">{mockStatusLabels[exam.status]}</span>
            </Link>
          ))}</div> : <div className="px-5 py-12 text-center"><p className="text-sm font-semibold text-navy">数学模試はまだ登録されていません</p><p className="mt-1 text-xs text-muted">作成すると第1問の候補問題がすぐに表示されます。</p><Link className="btn-primary mt-4" href="/admin/mocks/new">数学模試を作成</Link></div>}
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4"><h2 className="font-bold text-navy">作業メニュー</h2><p className="mt-1 text-xs text-muted">よく使う操作</p></div>
          <div className="divide-y divide-line">{workLinks.map((item) => <Link key={item.href} href={item.href} className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"><span><strong className="block text-sm font-semibold text-ink group-hover:text-brand-blue">{item.title}</strong><span className="mt-1 block text-xs text-muted">{item.description}</span></span><span className="text-sm text-muted">→</span></Link>)}</div>
        </section>
      </div>

      <section className="border-t border-line pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-navy">KDP出版管理</h2><p className="mt-1 text-xs text-muted">商品棚、売上CSV、Amazonクリック計測などの既存機能</p></div><Link className="btn-secondary" href="/admin/kdp">売上ダッシュボード</Link></div>
      </section>
    </div>
  </>;
}
