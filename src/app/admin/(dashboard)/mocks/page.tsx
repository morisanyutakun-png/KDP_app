import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-ui";
import { mockStatusLabels } from "@/lib/authoring-labels";
import { getSubjects, listMockExams, type MockExamSearch } from "@/lib/data/authoring";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value || "";

export default async function MockExamsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const rawStatus = one(query.status);
  const filters: MockExamSearch = {
    q: one(query.q) || undefined,
    subjectId: one(query.subjectId) || undefined,
    status: rawStatus === "DRAFT" || rawStatus === "READY" ? rawStatus : undefined,
    page: Number(one(query.page)) || 1,
  };
  const [{ rows, total, page, limit }, subjects] = await Promise.all([listMockExams(filters), getSubjects()]);
  const pages = Math.max(Math.ceil(total / limit), 1);
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (key !== "page" && typeof value === "string" && value) params.set(key, value);
    params.set("page", String(target));
    return `/admin/mocks?${params.toString()}`;
  };

  return <>
    <AdminPageHeader eyebrow="模試制作" title="模試・問題集" description={`${total}件。原稿から登録した模試の再編集と、新しい構成の作成ができます。`} action={<Link className="btn-primary" href="/admin/mocks/new">新しい模試</Link>} />
    <div className="workbench space-y-5">
      <form className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]" method="get">
        <label><span className="label">模試名・大学</span><input className="input" name="q" defaultValue={filters.q || ""} placeholder="名古屋大学、共通テスト、第3回…" /></label>
        <label><span className="label">科目</span><select className="input" name="subjectId" defaultValue={filters.subjectId || ""}><option value="">すべて</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
        <label><span className="label">状態</span><select className="input" name="status" defaultValue={filters.status || ""}><option value="">すべて</option><option value="DRAFT">編集中</option><option value="READY">完成</option></select></label>
        <div className="flex items-end gap-2"><button className="btn-primary" type="submit">絞り込む</button><Link className="btn-secondary" href="/admin/mocks">解除</Link></div>
      </form>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {rows.map(({ exam, subjectName, assigned }) => {
          const assignedCount = Number(assigned);
          const completion = Math.min(Math.round((assignedCount / Math.max(exam.questionCount, 1)) * 100), 100);
          return <Link href={`/admin/mocks/${exam.id}`} key={exam.id} className="card group p-5 transition hover:border-slate-400">
            <div className="flex items-start justify-between gap-4"><span className="border border-line bg-surface px-2 py-1 text-xs font-bold text-navy">{mockStatusLabels[exam.status]}</span><span className="text-xs text-muted">{formatDate(exam.updatedAt)}</span></div>
            <h2 className="mt-4 text-lg font-bold text-navy group-hover:underline">{exam.title}</h2>
            <p className="mt-2 text-sm text-muted">{subjectName || "科目未設定"}{exam.targetUniversity ? ` · ${exam.targetUniversity}` : ""}</p>
            <div className="mt-5 h-1.5 overflow-hidden bg-slate-100"><div className="h-full bg-navy" style={{ width: `${completion}%` }} /></div>
            <div className="mt-3 grid grid-cols-3 divide-x divide-line text-center text-xs"><div><strong className="block text-base text-navy">{assignedCount}/{exam.questionCount}</strong>配置</div><div><strong className="block text-base text-navy">{exam.durationMinutes}</strong>分</div><div><strong className="block text-base text-navy">{exam.paperSettings.paperSize}</strong>用紙</div></div>
          </Link>;
        })}
        {!rows.length && <div className="card col-span-full grid min-h-52 place-items-center p-8 text-center"><div><h2 className="font-bold text-navy">条件に合う模試がありません</h2><p className="mt-2 text-sm text-muted">条件を解除するか、新しい模試を作成してください。</p><Link className="btn-primary mt-5" href="/admin/mocks/new">新しい模試を作る</Link></div></div>}
      </div>

      {pages > 1 && <nav className="flex items-center justify-center gap-3"><Link aria-disabled={page <= 1} className={`btn-secondary ${page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={pageHref(page - 1)}>← 前へ</Link><span className="text-sm font-bold text-muted">{page} / {pages}</span><Link aria-disabled={page >= pages} className={`btn-secondary ${page >= pages ? "pointer-events-none opacity-40" : ""}`} href={pageHref(page + 1)}>次へ →</Link></nav>}
    </div>
  </>;
}
