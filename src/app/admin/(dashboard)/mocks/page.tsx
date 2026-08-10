import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-ui";
import { mockStatusLabels } from "@/lib/authoring-labels";
import { getMathSubject, getMockExamFacets, listMockExams, type MockExamSearch } from "@/lib/data/authoring";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value || "";

export default async function MockExamsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [query, mathSubject] = await Promise.all([searchParams, getMathSubject()]);
  const rawStatus = one(query.status);
  const filters: MockExamSearch = {
    subjectId: mathSubject?.id,
    targetUniversity: one(query.targetUniversity) || undefined,
    status: rawStatus === "DRAFT" || rawStatus === "READY" ? rawStatus : undefined,
    page: Number(one(query.page)) || 1,
  };
  const [result, facets] = await Promise.all([
    mathSubject ? listMockExams(filters) : Promise.resolve({ rows: [], total: 0, page: 1, limit: 24 }),
    mathSubject ? getMockExamFacets(mathSubject.id) : Promise.resolve({ universities: [] }),
  ]);
  const { rows, total, page, limit } = result;
  const pages = Math.max(Math.ceil(total / limit), 1);
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (key !== "page" && typeof value === "string" && value) params.set(key, value);
    params.set("page", String(target));
    return `/admin/mocks?${params.toString()}`;
  };

  return <>
    <AdminPageHeader eyebrow="数学専用" title="数学予想模試" description={`${total}件。数学の問題構成に集中して管理します。`} action={<Link className="btn-primary" href="/admin/mocks/new">新しい数学模試</Link>} />
    <div className="workbench space-y-5">
      <form className="card grid gap-3 p-4 sm:grid-cols-[minmax(220px,1fr)_180px_auto]" method="get">
        <label><span className="label">想定大学</span><select className="input" name="targetUniversity" defaultValue={filters.targetUniversity || ""}><option value="">すべての大学</option>{facets.universities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span className="label">状態</span><select className="input" name="status" defaultValue={filters.status || ""}><option value="">すべて</option><option value="DRAFT">編集中</option><option value="READY">完成</option></select></label>
        <div className="flex items-end gap-2"><button className="btn-primary" type="submit">絞り込む</button><Link className="btn-secondary" href="/admin/mocks">解除</Link></div>
      </form>

      {rows.length ? <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead><tr className="border-b border-line text-xs"><th className="px-4 py-3">状態</th><th className="px-4 py-3">模試名</th><th className="px-4 py-3">科目・対象</th><th className="w-44 px-4 py-3">問題構成</th><th className="px-4 py-3">紙面</th><th className="px-4 py-3">更新</th><th className="w-20 px-4 py-3"><span className="sr-only">操作</span></th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ exam, subjectName, assigned }) => {
              const assignedCount = Number(assigned);
              const completion = Math.min(Math.round((assignedCount / Math.max(exam.questionCount, 1)) * 100), 100);
              return <tr className="group hover:bg-slate-50" key={exam.id}>
                <td className="whitespace-nowrap px-4 py-4"><span className="border border-line bg-surface px-2 py-1 text-xs font-bold text-navy">{mockStatusLabels[exam.status]}</span></td>
                <td className="px-4 py-4"><Link className="font-bold text-navy group-hover:underline" href={`/admin/mocks/${exam.id}`}>{exam.title}</Link></td>
                <td className="px-4 py-4 text-sm"><span className="font-medium text-ink">{subjectName || "科目未設定"}</span>{exam.targetUniversity && <span className="mt-1 block text-xs text-muted">{exam.targetUniversity}</span>}</td>
                <td className="px-4 py-4"><div className="flex items-center justify-between gap-3 text-xs"><strong className="text-navy">{assignedCount}/{exam.questionCount}問</strong><span className="text-muted">{completion}%</span></div><div className="mt-2 h-1 overflow-hidden bg-slate-100"><div className="h-full bg-navy" style={{ width: `${completion}%` }} /></div></td>
                <td className="whitespace-nowrap px-4 py-4 text-xs text-muted">{exam.durationMinutes}分 · {exam.paperSettings.paperSize}</td>
                <td className="whitespace-nowrap px-4 py-4 text-xs text-muted">{formatDate(exam.updatedAt)}</td>
                <td className="px-4 py-4 text-right"><Link aria-label={`${exam.title}を編集`} className="btn-secondary min-h-9 px-3 py-1 text-xs" href={`/admin/mocks/${exam.id}`}>編集</Link></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div> : <div className="card grid min-h-52 place-items-center p-8 text-center"><div><h2 className="font-bold text-navy">条件に合う模試がありません</h2><p className="mt-2 text-sm text-muted">条件を解除するか、新しい模試を作成してください。</p><Link className="btn-primary mt-5" href="/admin/mocks/new">新しい模試を作る</Link></div></div>}

      {pages > 1 && <nav className="flex items-center justify-center gap-3"><Link aria-disabled={page <= 1} className={`btn-secondary ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={pageHref(page - 1)}>← 前へ</Link><span className="text-sm font-bold text-muted">{page} / {pages}</span><Link aria-disabled={page >= pages} className={`btn-secondary ${page >= pages ? "pointer-events-none opacity-40" : ""}`} href={pageHref(page + 1)}>次へ →</Link></nav>}
    </div>
  </>;
}
