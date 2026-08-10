import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addMockSlotAction,
  archiveMockExamAction,
  assignProblemAction,
  autoAssignEmptySlotsAction,
  clearSlotAction,
  duplicateMockExamAction,
  moveSlotProblemAction,
  removeLastEmptyMockSlotAction,
  updateMockSettingsAction,
  updateSlotFiltersAction,
} from "@/app/admin/author-actions";
import { AdminPageHeader } from "@/components/admin-ui";
import { MathMarkdown } from "@/components/math-markdown";
import { getTimeBandRange, mockStatusLabels, timeBandOptions, verificationLabels } from "@/lib/authoring-labels";
import {
  getMathSubject,
  getMockCandidates,
  getMockExam,
  getProblemFacets,
  getUsedProblemIds,
  type ProblemSearch,
} from "@/lib/data/authoring";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value || "";

function candidateSearch(query: Query): ProblemSearch {
  const usage = one(query.candidateUsage);
  const verification = one(query.candidateVerification);
  const sort = one(query.candidateSort);
  const difficulty = Number(one(query.candidateDifficulty)) || undefined;
  const university = one(query.candidateUniversity) || undefined;
  const timeBand = getTimeBandRange(one(query.candidateTimeBand));
  return {
    field: one(query.candidateField) || undefined,
    subfield: one(query.candidateSubfield) || undefined,
    targetUniversity: university,
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
      : "least-used",
    ignoreExamTarget: !university,
    page: Number(one(query.candidatePage)) || 1,
    limit: 8,
  };
}

export default async function MockBuilderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [data, usedElsewhere, mathSubject] = await Promise.all([
    getMockExam(id),
    getUsedProblemIds(id),
    getMathSubject(),
  ]);
  if (!data) notFound();

  const requestedSlot = one(query.slot);
  const selectedItem = requestedSlot && data.items.some(({ item }) => item.id === requestedSlot)
    ? requestedSlot
    : data.items.find(({ problem }) => !problem)?.item.id || data.items[0]?.item.id;
  const filters = candidateSearch(query);
  const facets = mathSubject
    ? await getProblemFacets(mathSubject.id)
    : { fields: [], subfields: [], universities: [] };
  const candidateData = selectedItem && mathSubject
    ? await getMockCandidates(id, selectedItem, { ...filters, subjectId: mathSubject.id })
    : null;
  const assigned = data.items.filter(({ problem }) => problem);
  const emptyCount = data.items.length - assigned.length;
  const totalMinutes = assigned.reduce((sum, { problem }) => sum + (problem?.estimatedMinutes || 0), 0);
  const averageDifficulty = assigned.length
    ? assigned.reduce((sum, { problem }) => sum + (problem?.difficulty || 0), 0) / assigned.length
    : 0;
  const duplicateUse = assigned.filter(({ problem }) => problem && usedElsewhere.has(problem.id)).length;
  const complete = emptyCount === 0;
  const lastSlotIsEmpty = !data.items.at(-1)?.problem;
  const paper = data.exam.paperSettings;

  const hrefWith = (updates: Record<string, string | undefined>, hash = "") => {
    const url = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (typeof value === "string" && value) url.set(key, value);
    for (const [key, value] of Object.entries(updates)) {
      if (value) url.set(key, value);
      else url.delete(key);
    }
    const suffix = url.size ? `?${url.toString()}` : "";
    return `/admin/mocks/${id}${suffix}${hash}`;
  };
  const candidatePageHref = (page: number) => hrefWith({ candidatePage: String(page) }, "#candidates");

  return <>
    <AdminPageHeader
      eyebrow="数学予想模試"
      title={data.exam.title}
      description={`${assigned.length}/${data.items.length}問を配置 · 想定${totalMinutes}分`}
      action={<div className="flex flex-wrap gap-2">
        <form action={duplicateMockExamAction.bind(null, id)}><button className="btn-secondary" type="submit">複製</button></form>
        <Link className="btn-secondary" href={`/admin/print/${id}?mode=questions`}>最終紙面</Link>
      </div>}
    />

    <div className="workbench max-w-[1600px] space-y-4">
      <section className="card flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-xs">
        <span><span className="text-muted">配置</span> <strong className="ml-1 text-navy">{assigned.length}/{data.items.length}問</strong></span>
        <span><span className="text-muted">合計時間</span> <strong className="ml-1 text-navy">{totalMinutes}分</strong></span>
        <span><span className="text-muted">平均難易度</span> <strong className="ml-1 text-navy">{averageDifficulty ? averageDifficulty.toFixed(1) : "—"}</strong></span>
        <span><span className="text-muted">他模試で使用</span> <strong className="ml-1 text-navy">{duplicateUse}問</strong></span>
        <div className="ml-auto h-1.5 w-full overflow-hidden bg-slate-100 sm:w-44"><div className="h-full bg-navy" style={{ width: `${Math.round((assigned.length / Math.max(data.items.length, 1)) * 100)}%` }} /></div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-4">
          <section className="card overflow-hidden">
            <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3"><h2 className="text-sm font-bold text-navy">大問構成</h2><span className="text-xs text-muted">数学</span></header>
            <nav aria-label="大問の選択" className="divide-y divide-line">
              {data.items.map(({ item, problem }, index) => <div className={`p-3 ${selectedItem === item.id ? "border-l-2 border-navy bg-surface" : ""}`} key={item.id}>
                <div className="flex items-start gap-3">
                  <Link className="grid size-8 shrink-0 place-items-center bg-navy text-xs font-bold text-white" href={`/admin/mocks/${id}?slot=${item.id}#candidates`}>{item.position}</Link>
                  <div className="min-w-0 flex-1"><Link className="block truncate text-sm font-bold text-navy" href={`/admin/mocks/${id}?slot=${item.id}#candidates`}>{problem?.title || problem?.code || "問題未選択"}</Link><p className="mt-1 truncate text-[11px] text-muted">{problem ? `${problem.field} · 難易度${problem.difficulty} · ${problem.estimatedMinutes}分` : "候補を表示中"}</p></div>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1"><form action={moveSlotProblemAction.bind(null, id, item.id, "up")}><button aria-label={`第${item.position}問を上へ`} className="border border-line bg-white px-2 py-1 text-xs text-navy disabled:opacity-30" disabled={index === 0} type="submit">↑</button></form><form action={moveSlotProblemAction.bind(null, id, item.id, "down")}><button aria-label={`第${item.position}問を下へ`} className="border border-line bg-white px-2 py-1 text-xs text-navy disabled:opacity-30" disabled={index === data.items.length - 1} type="submit">↓</button></form>{problem && <form action={clearSlotAction.bind(null, id, item.id)}><button className="border border-line bg-white px-2 py-1 text-xs text-muted" type="submit">外す</button></form>}</div>
                <details className="mt-2"><summary className="cursor-pointer text-[11px] font-bold text-muted">自動選定条件</summary><form action={updateSlotFiltersAction.bind(null, id, item.id)} className="mt-3 space-y-2 border-t border-line pt-3"><label><span className="label text-[11px]">分野</span><select className="input" name="fieldFilter" defaultValue={item.fieldFilter || ""}><option value="">指定なし</option>{facets.fields.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span className="label text-[11px]">サブ分野</span><select className="input" name="subfieldFilter" defaultValue={item.subfieldFilter || ""}><option value="">指定なし</option>{facets.subfields.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span className="label text-[11px]">難易度</span><select className="input" name="difficultyMin" defaultValue={item.difficultyMin || ""}><option value="">指定なし</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select><input name="difficultyMax" type="hidden" value={item.difficultyMin || ""} /></label><label><span className="label text-[11px]">使用履歴</span><select className="input" name="unusedOnly" defaultValue={item.unusedOnly ? "true" : ""}><option value="">指定なし</option><option value="true">未使用のみ</option></select></label><button className="btn-secondary w-full" type="submit">保存して候補を表示</button></form></details>
              </div>)}
            </nav>
            <div className="grid gap-2 border-t border-line p-3">
              {emptyCount > 0 && <form action={autoAssignEmptySlotsAction.bind(null, id)}><button className="btn-secondary w-full" type="submit">空欄を自動で仮配置</button></form>}
              <div className="grid grid-cols-2 gap-2"><form action={addMockSlotAction.bind(null, id)}><button className="btn-secondary w-full px-2" disabled={data.items.length >= 20} type="submit">大問を追加</button></form><form action={removeLastEmptyMockSlotAction.bind(null, id)}><button className="btn-secondary w-full px-2" disabled={data.items.length <= 1 || !lastSlotIsEmpty} type="submit">空欄を削除</button></form></div>
            </div>
          </section>

          <details className="card overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4"><span><strong className="block text-sm text-navy">模試設定</strong><span className="mt-1 block text-[11px] text-muted">構成後に必要な項目だけ変更</span></span><span className="border border-line bg-surface px-2 py-1 text-[11px] font-bold text-navy">{mockStatusLabels[data.exam.status]}</span></summary>
            <form action={updateMockSettingsAction.bind(null, id)} className="space-y-3 border-t border-line p-4">
              <input name="subjectId" type="hidden" value={mathSubject?.id || data.exam.subjectId || ""} />
              <label><span className="label text-xs">模試名</span><input className="input" name="title" required defaultValue={data.exam.title} /></label>
              <label><span className="label text-xs">想定大学</span><select className="input" name="targetUniversity" defaultValue={data.exam.targetUniversity || ""}><option value="">指定なし</option>{facets.universities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-2"><label><span className="label text-xs">試験時間</span><input className="input" name="durationMinutes" type="number" min="1" max="600" defaultValue={data.exam.durationMinutes} /></label><label><span className="label text-xs">状態</span><select className="input" name="status" defaultValue={data.exam.status}><option value="DRAFT">編集中</option><option value="READY" disabled={!complete}>完成</option></select></label><label><span className="label text-xs">用紙</span><select className="input" name="paperSize" defaultValue={paper.paperSize}><option value="B5">B5</option><option value="A4">A4</option></select></label><label><span className="label text-xs">文字 pt</span><input className="input" name="fontSize" type="number" min="9" max="14" defaultValue={paper.fontSize} /></label><label><span className="label text-xs">余白 mm</span><input className="input" name="marginMm" type="number" min="8" max="35" defaultValue={paper.marginMm} /></label><label><span className="label text-xs">段組</span><select className="input" name="columns" defaultValue={String(paper.columns)}><option value="1">1段</option><option value="2">2段</option></select></label></div>
              <div className="space-y-2 text-xs"><label className="flex items-center gap-2"><input type="checkbox" name="showPageNumbers" defaultChecked={paper.showPageNumbers} />ページ番号</label><label className="flex items-center gap-2"><input type="checkbox" name="pageBreakPerProblem" defaultChecked={paper.pageBreakPerProblem} />問題ごとに改ページ</label></div>
              <button className="btn-primary w-full" type="submit">設定を保存</button>
            </form>
          </details>
        </aside>

        <main className="min-w-0" id="candidates">
          {!mathSubject && <section className="card p-8 text-center"><h2 className="font-bold text-navy">数学科目が登録されていません</h2><p className="mt-2 text-sm text-muted">DBセットアップを確認してください。</p></section>}
          {candidateData && <section className="card overflow-hidden">
            <header className="border-b border-line bg-surface px-5 py-4"><p className="text-xs text-muted">第{candidateData.slot.position}問</p><div className="mt-1 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-navy">候補問題から選ぶ</h2><span className="text-xs font-bold text-muted">{candidateData.candidates.total}件</span></div><p className="mt-2 text-xs text-muted">問題文を読み比べて、採用する問題を選択してください。</p></header>

            <form className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4" method="get">
              <input name="slot" type="hidden" value={candidateData.slot.id} />
              <label><span className="label text-xs">分野</span><select className="input" name="candidateField" defaultValue={candidateData.filters.field || ""}><option value="">すべて</option>{facets.fields.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label><span className="label text-xs">サブ分野</span><select className="input" name="candidateSubfield" defaultValue={candidateData.filters.subfield || ""}><option value="">すべて</option>{facets.subfields.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label><span className="label text-xs">想定大学</span><select className="input" name="candidateUniversity" defaultValue={candidateData.filters.targetUniversity || ""}><option value="">すべて</option>{facets.universities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label><span className="label text-xs">難易度</span><select className="input" name="candidateDifficulty" defaultValue={candidateData.filters.difficultyMin === candidateData.filters.difficultyMax ? candidateData.filters.difficultyMin || "" : ""}><option value="">すべて</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>難易度 {value}</option>)}</select></label>
              <label><span className="label text-xs">想定時間</span><select className="input" name="candidateTimeBand" defaultValue={one(query.candidateTimeBand)}><option value="">すべて</option>{timeBandOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span className="label text-xs">使用履歴</span><select className="input" name="candidateUsage" defaultValue={candidateData.filters.usage || ""}><option value="">すべて</option><option value="unused">未使用のみ</option><option value="used">使用済みのみ</option></select></label>
              <label><span className="label text-xs">検証状態</span><select className="input" name="candidateVerification" defaultValue={candidateData.filters.verification || ""}><option value="">すべて</option>{Object.entries(verificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span className="label text-xs">並び順</span><select className="input" name="candidateSort" defaultValue={candidateData.filters.sort || "least-used"}><option value="least-used">使用回数が少ない順</option><option value="time-asc">短時間順</option><option value="difficulty-asc">易しい順</option><option value="difficulty-desc">難しい順</option><option value="recent">更新が新しい順</option></select></label>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button className="btn-primary" type="submit">この条件で絞り込む</button><Link className="btn-secondary" href={`/admin/mocks/${id}?slot=${candidateData.slot.id}#candidates`}>条件を解除</Link></div>
            </form>

            <div className="divide-y divide-line">
              {candidateData.candidates.rows.map(({ problem, usageCount }) => <article key={problem.id}>
                <header className="flex flex-col gap-3 border-b border-line bg-white px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><h3 className="font-bold text-navy">{problem.title || problem.code}</h3><p className="mt-1 text-xs text-muted">{problem.code} · {problem.field}{problem.subfield ? ` / ${problem.subfield}` : ""} · 難易度{problem.difficulty} · {problem.estimatedMinutes}分 · 使用{Number(usageCount)}回</p>{problem.targetUniversity && <p className="mt-1 text-xs text-muted">想定：{problem.targetUniversity}</p>}</div>
                  <form className="shrink-0" action={assignProblemAction.bind(null, id, candidateData.slot.id, problem.id)}><button className="btn-primary w-full sm:w-auto" type="submit">第{candidateData.slot.position}問に採用</button></form>
                </header>
                <div className="p-5 sm:p-7">{problem.imageUrl && <Image unoptimized src={problem.imageUrl} alt="問題図" width={900} height={600} className="mx-auto mb-5 max-h-72 w-auto object-contain" />}<MathMarkdown source={problem.statement} /><details className="mt-5 border-t border-line pt-3"><summary className="cursor-pointer text-xs font-bold text-muted">解答・解説を確認</summary><div className="mt-4 grid gap-5 lg:grid-cols-2"><section><h4 className="mb-2 text-sm font-bold text-navy">解答</h4><MathMarkdown source={problem.answer || "未入力"} /></section><section><h4 className="mb-2 text-sm font-bold text-navy">解説</h4><MathMarkdown source={problem.explanation || "未入力"} /></section></div></details></div>
              </article>)}
              {!candidateData.candidates.rows.length && <div className="p-10 text-center"><h3 className="font-bold text-navy">条件に合う数学問題がありません</h3><p className="mt-2 text-sm text-muted">いずれかのプルダウンを「すべて」に戻してください。</p></div>}
            </div>
            {candidateData.candidates.total > candidateData.candidates.limit && <nav className="flex items-center justify-center gap-3 border-t border-line p-4"><Link className={`btn-secondary ${candidateData.candidates.page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={candidatePageHref(candidateData.candidates.page - 1)}>← 前へ</Link><span className="text-sm font-bold text-muted">{candidateData.candidates.page} / {Math.ceil(candidateData.candidates.total / candidateData.candidates.limit)}</span><Link className={`btn-secondary ${candidateData.candidates.page * candidateData.candidates.limit >= candidateData.candidates.total ? "pointer-events-none opacity-40" : ""}`} href={candidatePageHref(candidateData.candidates.page + 1)}>次へ →</Link></nav>}
          </section>}

          <section className="mt-4 card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-sm font-bold text-navy">最後に紙面を確認</h2><p className="mt-1 text-xs text-muted">問題構成が決まったあとに、印刷レイアウトと解答冊子を確認します。</p></div>
            <div className="flex flex-wrap gap-2"><Link className="btn-primary" href={`/admin/print/${id}?mode=questions`}>紙面プレビュー</Link><a className="btn-secondary" href={`/admin/mocks/${id}/export/markdown?mode=combined`}>Markdown</a><a className="btn-secondary" href={`/admin/mocks/${id}/export/latex?mode=combined`}>LaTeX</a></div>
          </section>
          <form className="mt-4 text-right" action={archiveMockExamAction.bind(null, id)}><button className="text-xs font-bold text-muted underline" type="submit">この模試をアーカイブ</button></form>
        </main>
      </div>
    </div>
  </>;
}
