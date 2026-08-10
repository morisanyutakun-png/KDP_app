import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-ui";
import { excerpt, verificationLabels } from "@/lib/authoring-labels";
import { getSubjects, searchProblems, type ProblemSearch } from "@/lib/data/authoring";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value || "";

export default async function ProblemBankPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const filters: ProblemSearch = {
    q: one(query.q) || undefined,
    subjectId: one(query.subjectId) || undefined,
    field: one(query.field) || undefined,
    subfield: one(query.subfield) || undefined,
    targetUniversity: one(query.targetUniversity) || undefined,
    difficultyMin: Number(one(query.difficultyMin)) || undefined,
    difficultyMax: Number(one(query.difficultyMax)) || undefined,
    timeMax: Number(one(query.timeMax)) || undefined,
    usage: one(query.usage) as ProblemSearch["usage"] || undefined,
    verification: one(query.verification) as ProblemSearch["verification"] || undefined,
    page: Number(one(query.page)) || 1,
  };
  const [{ rows, total, page, limit }, subjectOptions] = await Promise.all([searchProblems(filters), getSubjects()]);
  const pages = Math.max(Math.ceil(total / limit), 1);
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (key !== "page" && typeof value === "string" && value) params.set(key, value);
    params.set("page", String(target));
    return `/admin/problems?${params}`;
  };
  return <>
    <AdminPageHeader eyebrow="問題管理" title="問題データベース" description={`${total}問。条件を組み合わせて候補をすばやく絞り込めます。`} action={<Link className="btn-primary" href="/admin/problems/new">問題を登録</Link>} />
    <div className="workbench space-y-5">
      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6" method="get">
        <label className="sm:col-span-2"><span className="label">キーワード</span><input className="input" name="q" defaultValue={filters.q} placeholder="ID・本文・分野" /></label>
        <label><span className="label">科目</span><select className="input" name="subjectId" defaultValue={filters.subjectId || ""}><option value="">すべて</option>{subjectOptions.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
        <label><span className="label">分野</span><input className="input" name="field" defaultValue={filters.field} placeholder="微積分" /></label>
        <label><span className="label">サブ分野</span><input className="input" name="subfield" defaultValue={filters.subfield} /></label>
        <label><span className="label">想定大学</span><input className="input" name="targetUniversity" defaultValue={filters.targetUniversity} /></label>
        <label><span className="label">難易度（下限）</span><select className="input" name="difficultyMin" defaultValue={filters.difficultyMin || ""}><option value="">指定なし</option>{[1,2,3,4,5].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <label><span className="label">難易度（上限）</span><select className="input" name="difficultyMax" defaultValue={filters.difficultyMax || ""}><option value="">指定なし</option>{[1,2,3,4,5].map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
        <label><span className="label">想定時間（最大）</span><input className="input" type="number" min="1" name="timeMax" defaultValue={filters.timeMax} /></label>
        <label><span className="label">使用履歴</span><select className="input" name="usage" defaultValue={filters.usage || ""}><option value="">すべて</option><option value="unused">未使用のみ</option><option value="used">使用済みのみ</option></select></label>
        <label><span className="label">検証状態</span><select className="input" name="verification" defaultValue={filters.verification || ""}><option value="">すべて</option>{Object.entries(verificationLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="flex items-end gap-2"><button className="btn-primary flex-1" type="submit">絞り込む</button><Link className="btn-secondary px-3" href="/admin/problems">解除</Link></div>
      </form>

      <div className="card overflow-hidden">
        {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-surface text-xs text-muted"><tr><th className="px-5 py-3">問題</th><th className="px-4 py-3">分類</th><th className="px-4 py-3">難易度</th><th className="px-4 py-3">時間</th><th className="px-4 py-3">検証</th><th className="px-4 py-3">使用</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-line">{rows.map(({ problem, subjectName, usageCount }) => <tr key={problem.id} className="hover:bg-slate-50"><td className="px-5 py-4"><strong className="block text-navy">{problem.code}</strong><span className="mt-1 block max-w-xl text-xs leading-5 text-muted">{excerpt(problem.statement)}</span></td><td className="px-4 py-4"><strong className="block text-xs text-navy">{subjectName || "未分類"}</strong><span className="mt-1 block text-xs text-muted">{problem.field}{problem.subfield ? ` / ${problem.subfield}` : ""}</span><span className="mt-1 block text-xs text-muted">{problem.targetUniversity || "想定大学なし"}</span></td><td className="px-4 py-4 font-bold text-navy">{problem.difficulty} / 5</td><td className="px-4 py-4 text-xs text-muted">{problem.estimatedMinutes}分</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${problem.verificationStatus === "VERIFIED" ? "bg-teal-50 text-teal" : "bg-slate-100 text-muted"}`}>{verificationLabels[problem.verificationStatus]}</span></td><td className="px-4 py-4 text-xs font-bold text-muted">{Number(usageCount)}回</td><td className="px-5 py-4 text-right"><Link className="font-bold text-brand-blue hover:underline" href={`/admin/problems/${problem.id}`}>詳細 →</Link></td></tr>)}</tbody></table></div> : <div className="grid min-h-64 place-items-center p-8 text-center"><div><h2 className="font-bold text-navy">条件に合う問題がありません</h2><p className="mt-2 text-sm text-muted">条件を変更するか、新しい問題を登録してください。</p></div></div>}
      </div>
      {pages > 1 && <nav className="flex items-center justify-center gap-3"><Link aria-disabled={page <= 1} className={`btn-secondary ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={pageHref(page - 1)}>← 前へ</Link><span className="text-sm font-bold text-muted">{page} / {pages}</span><Link aria-disabled={page >= pages} className={`btn-secondary ${page >= pages ? "pointer-events-none opacity-40" : ""}`} href={pageHref(page + 1)}>次へ →</Link></nav>}
    </div>
  </>;
}
