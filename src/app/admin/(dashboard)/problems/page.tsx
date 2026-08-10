import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-ui";
import { excerpt, getTimeBandRange, timeBandOptions, verificationLabels } from "@/lib/authoring-labels";
import { getMathSubject, getProblemFacets, searchProblems, type ProblemSearch } from "@/lib/data/authoring";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value || "";

export default async function ProblemBankPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [query, mathSubject] = await Promise.all([searchParams, getMathSubject()]);
  const difficulty = Number(one(query.difficulty)) || undefined;
  const timeBand = getTimeBandRange(one(query.timeBand));
  const usage = one(query.usage);
  const verification = one(query.verification);
  const sort = one(query.sort);
  const filters: ProblemSearch = {
    subjectId: mathSubject?.id,
    field: one(query.field) || undefined,
    subfield: one(query.subfield) || undefined,
    targetUniversity: one(query.targetUniversity) || undefined,
    difficultyMin: difficulty,
    difficultyMax: difficulty,
    timeMin: timeBand?.min,
    timeMax: timeBand?.max,
    usage: usage === "used" || usage === "unused" ? usage : undefined,
    verification: ["DRAFT", "REVIEWING", "VERIFIED", "NEEDS_REVISION"].includes(verification)
      ? verification as ProblemSearch["verification"]
      : undefined,
    sort: ["recent", "difficulty-asc", "difficulty-desc", "time-asc", "least-used"].includes(sort)
      ? sort as ProblemSearch["sort"]
      : "recent",
    page: Number(one(query.page)) || 1,
  };
  const [result, facets] = await Promise.all([
    mathSubject ? searchProblems(filters) : Promise.resolve({ rows: [], total: 0, page: 1, limit: 30 }),
    mathSubject ? getProblemFacets(mathSubject.id) : Promise.resolve({ fields: [], subfields: [], universities: [] }),
  ]);
  const { rows, total, page, limit } = result;
  const pages = Math.max(Math.ceil(total / limit), 1);
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (key !== "page" && typeof value === "string" && value) params.set(key, value);
    params.set("page", String(target));
    return `/admin/problems?${params}`;
  };
  return <>
    <AdminPageHeader eyebrow="数学専用" title="数学問題データベース" description={`${total}問。登録済みの選択肢だけで絞り込みます。`} action={<Link className="btn-primary" href="/admin/problems/new">数学問題を登録</Link>} />
    <div className="workbench space-y-5">
      <form className="card p-4" method="get">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label><span className="label text-xs">分野</span><select className="input" name="field" defaultValue={filters.field || ""}><option value="">すべての分野</option>{facets.fields.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span className="label text-xs">サブ分野</span><select className="input" name="subfield" defaultValue={filters.subfield || ""}><option value="">すべてのサブ分野</option>{facets.subfields.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span className="label text-xs">想定大学</span><select className="input" name="targetUniversity" defaultValue={filters.targetUniversity || ""}><option value="">すべての大学</option>{facets.universities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span className="label text-xs">難易度</span><select className="input" name="difficulty" defaultValue={difficulty || ""}><option value="">すべて</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>難易度 {value}</option>)}</select></label>
          <label><span className="label text-xs">想定時間</span><select className="input" name="timeBand" defaultValue={one(query.timeBand)}><option value="">すべて</option>{timeBandOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span className="label text-xs">使用履歴</span><select className="input" name="usage" defaultValue={filters.usage || ""}><option value="">すべて</option><option value="unused">未使用のみ</option><option value="used">使用済みのみ</option></select></label>
          <label><span className="label text-xs">検証状態</span><select className="input" name="verification" defaultValue={filters.verification || ""}><option value="">すべて</option>{Object.entries(verificationLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="label text-xs">並び順</span><select className="input" name="sort" defaultValue={filters.sort || "recent"}><option value="recent">更新が新しい順</option><option value="least-used">使用回数が少ない順</option><option value="time-asc">短時間順</option><option value="difficulty-asc">易しい順</option><option value="difficulty-desc">難しい順</option></select></label>
        </div>
        <div className="mt-4 flex gap-2"><button className="btn-primary" type="submit">この条件で絞り込む</button><Link className="btn-secondary" href="/admin/problems">条件を解除</Link></div>
      </form>

      <div className="card overflow-hidden">
        {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-surface text-xs text-muted"><tr><th className="px-5 py-3">問題</th><th className="px-4 py-3">分類</th><th className="px-4 py-3">難易度</th><th className="px-4 py-3">時間</th><th className="px-4 py-3">検証</th><th className="px-4 py-3">使用</th><th className="px-5 py-3" /></tr></thead><tbody className="divide-y divide-line">{rows.map(({ problem, subjectName, usageCount }) => <tr key={problem.id} className="hover:bg-slate-50"><td className="px-5 py-4"><strong className="block text-navy">{problem.title || problem.code}</strong><span className="mt-0.5 block text-[11px] font-medium text-muted">{problem.code}</span><span className="mt-1 block max-w-xl text-xs leading-5 text-muted">{excerpt(problem.statement)}</span></td><td className="px-4 py-4"><strong className="block text-xs text-navy">{subjectName || "未分類"}</strong><span className="mt-1 block text-xs text-muted">{problem.field}{problem.subfield ? ` / ${problem.subfield}` : ""}</span><span className="mt-1 block text-xs text-muted">{problem.targetUniversity || "想定大学なし"}</span></td><td className="px-4 py-4 font-bold text-navy">{problem.difficulty} / 5</td><td className="px-4 py-4 text-xs text-muted">{problem.estimatedMinutes}分</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${problem.verificationStatus === "VERIFIED" ? "bg-teal-50 text-teal" : "bg-slate-100 text-muted"}`}>{verificationLabels[problem.verificationStatus]}</span></td><td className="px-4 py-4 text-xs font-bold text-muted">{Number(usageCount)}回</td><td className="px-5 py-4 text-right"><Link className="font-bold text-brand-blue hover:underline" href={`/admin/problems/${problem.id}`}>詳細 →</Link></td></tr>)}</tbody></table></div> : <div className="grid min-h-64 place-items-center p-8 text-center"><div><h2 className="font-bold text-navy">条件に合う問題がありません</h2><p className="mt-2 text-sm text-muted">条件を変更するか、新しい問題を登録してください。</p></div></div>}
      </div>
      {pages > 1 && <nav className="flex items-center justify-center gap-3"><Link aria-disabled={page <= 1} className={`btn-secondary ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={pageHref(page - 1)}>← 前へ</Link><span className="text-sm font-bold text-muted">{page} / {pages}</span><Link aria-disabled={page >= pages} className={`btn-secondary ${page >= pages ? "pointer-events-none opacity-40" : ""}`} href={pageHref(page + 1)}>次へ →</Link></nav>}
    </div>
  </>;
}
