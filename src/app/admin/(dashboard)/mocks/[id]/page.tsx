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
import { ExamPaper, type ExamPaperMode } from "@/components/exam-paper";
import { MathMarkdown } from "@/components/math-markdown";
import { excerpt, mockStatusLabels, verificationLabels } from "@/lib/authoring-labels";
import {
  getMockCandidates,
  getMockExam,
  getProblemFacets,
  getSubjects,
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
  return {
    q: one(query.candidateQ) || undefined,
    field: one(query.candidateField) || undefined,
    subfield: one(query.candidateSubfield) || undefined,
    targetUniversity: one(query.candidateUniversity) || undefined,
    difficultyMin: Number(one(query.candidateDifficultyMin)) || undefined,
    difficultyMax: Number(one(query.candidateDifficultyMax)) || undefined,
    timeMin: Number(one(query.candidateTimeMin)) || undefined,
    timeMax: Number(one(query.candidateTimeMax)) || undefined,
    usage: usage === "used" || usage === "unused" ? usage : undefined,
    verification: ["DRAFT", "REVIEWING", "VERIFIED", "NEEDS_REVISION"].includes(verification)
      ? verification as ProblemSearch["verification"]
      : undefined,
    sort: ["recent", "difficulty-asc", "difficulty-desc", "time-asc", "least-used"].includes(sort)
      ? sort as ProblemSearch["sort"]
      : "least-used",
    ignoreExamTarget: one(query.candidateAllUniversities) === "1",
    page: Number(one(query.candidatePage)) || 1,
    limit: 12,
  };
}

export default async function MockBuilderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [data, usedElsewhere, subjects] = await Promise.all([
    getMockExam(id),
    getUsedProblemIds(id),
    getSubjects(),
  ]);
  if (!data) notFound();

  const facets = await getProblemFacets(data.exam.subjectId || undefined);
  const requestedSlot = one(query.slot);
  const selectedItem = requestedSlot && data.items.some(({ item }) => item.id === requestedSlot) ? requestedSlot : undefined;
  const candidateData = selectedItem ? await getMockCandidates(id, selectedItem, candidateSearch(query)) : null;
  const rawPreviewMode = one(query.preview);
  const previewMode: ExamPaperMode = rawPreviewMode === "answers" || rawPreviewMode === "combined" ? rawPreviewMode : "questions";
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
  const candidatePageHref = (page: number) => hrefWith({ candidatePage: String(page) }, "#workspace");

  return <>
    <AdminPageHeader
      eyebrow="模試制作"
      title={data.exam.title}
      description={`${data.subjectName || "科目未設定"} · ${data.exam.durationMinutes}分 · ${data.exam.questionCount}問`}
      action={<div className="flex flex-wrap gap-2">
        <form action={duplicateMockExamAction.bind(null, id)}><button className="btn-secondary" type="submit">複製</button></form>
        <a className="btn-secondary" href={`/admin/mocks/${id}/export/latex?mode=combined`}>LaTeX</a>
        <Link className="btn-primary" href={`/admin/print/${id}?mode=${previewMode}`}>印刷・PDF</Link>
      </div>}
    />

    <div className="workbench max-w-[1680px] space-y-4" id="workspace">
      <section className="card flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <span><span className="text-muted">配置</span> <strong className="ml-1 text-navy">{assigned.length}/{data.items.length}問</strong></span>
          <span><span className="text-muted">想定時間</span> <strong className="ml-1 text-navy">{totalMinutes}/{data.exam.durationMinutes}分</strong></span>
          <span><span className="text-muted">平均難易度</span> <strong className="ml-1 text-navy">{averageDifficulty ? averageDifficulty.toFixed(1) : "—"}</strong></span>
          <span><span className="text-muted">他模試でも使用</span> <strong className="ml-1 text-navy">{duplicateUse}問</strong></span>
        </div>
        <div className="h-1.5 w-full overflow-hidden bg-slate-100 lg:w-48"><div className="h-full bg-navy" style={{ width: `${Math.round((assigned.length / Math.max(data.items.length, 1)) * 100)}%` }} /></div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className={`${selectedItem ? "order-1" : "order-2"} space-y-4 xl:order-1 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1`}>
          {candidateData ? <section className="card overflow-hidden">
            <header className="flex items-start justify-between gap-3 border-b border-line bg-surface p-4">
              <div><p className="text-xs text-muted">第{candidateData.slot.position}問</p><h2 className="mt-1 font-bold text-navy">問題を差し替える</h2></div>
              <Link className="text-xs font-bold text-muted underline" href={hrefWith({ slot: undefined, candidatePage: undefined }, `#preview-slot-${candidateData.slot.id}`)}>閉じる</Link>
            </header>

            <form className="space-y-3 border-b border-line p-4" method="get">
              <input name="slot" type="hidden" value={candidateData.slot.id} />
              {previewMode !== "questions" && <input name="preview" type="hidden" value={previewMode} />}
              <label><span className="label text-xs">キーワード</span><input className="input" name="candidateQ" defaultValue={candidateData.filters.q || ""} placeholder="タイトル・問題ID・本文" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label><span className="label text-xs">分野</span><select className="input" name="candidateField" defaultValue={candidateData.filters.field || ""}><option value="">すべて</option>{facets.fields.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                <label><span className="label text-xs">並び順</span><select className="input" name="candidateSort" defaultValue={candidateData.filters.sort || "least-used"}><option value="least-used">未使用に近い順</option><option value="time-asc">短時間順</option><option value="difficulty-asc">易しい順</option><option value="difficulty-desc">難しい順</option><option value="recent">新しい順</option></select></label>
              </div>
              <label><span className="label text-xs">難易度</span><span className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><select aria-label="難易度の下限" className="input" name="candidateDifficultyMin" defaultValue={candidateData.filters.difficultyMin || ""}><option value="">1</option>{[2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select><span className="text-muted">–</span><select aria-label="難易度の上限" className="input" name="candidateDifficultyMax" defaultValue={candidateData.filters.difficultyMax || ""}><option value="">5</option>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}</select></span></label>
              <details className="border-t border-line pt-3">
                <summary className="cursor-pointer text-xs font-bold text-navy">詳細条件</summary>
                <div className="mt-3 space-y-3">
                  <label><span className="label text-xs">サブ分野</span><select className="input" name="candidateSubfield" defaultValue={candidateData.filters.subfield || ""}><option value="">すべて</option>{facets.subfields.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label><span className="label text-xs">想定大学</span><input className="input" list="mock-university-options" name="candidateUniversity" defaultValue={candidateData.filters.targetUniversity || ""} /></label>
                  <label><span className="label text-xs">想定時間（分）</span><span className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><input aria-label="想定時間の下限" className="input" min="1" name="candidateTimeMin" type="number" defaultValue={candidateData.filters.timeMin || ""} /><span className="text-muted">–</span><input aria-label="想定時間の上限" className="input" min="1" name="candidateTimeMax" type="number" defaultValue={candidateData.filters.timeMax || ""} /></span></label>
                  <div className="grid grid-cols-2 gap-3"><label><span className="label text-xs">使用履歴</span><select className="input" name="candidateUsage" defaultValue={candidateData.filters.usage || ""}><option value="">すべて</option><option value="unused">未使用のみ</option><option value="used">使用済みのみ</option></select></label><label><span className="label text-xs">検証状態</span><select className="input" name="candidateVerification" defaultValue={candidateData.filters.verification || ""}><option value="">すべて</option>{Object.entries(verificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
                  <label className="flex items-center gap-2 text-xs font-bold"><input name="candidateAllUniversities" type="checkbox" value="1" defaultChecked={candidateData.filters.ignoreExamTarget} />大学条件を使わない</label>
                </div>
              </details>
              <div className="grid grid-cols-[1fr_auto] gap-2"><button className="btn-primary" type="submit">候補を絞り込む</button><Link className="btn-secondary px-3" href={`/admin/mocks/${id}?slot=${candidateData.slot.id}#workspace`}>初期化</Link></div>
            </form>

            <div className="flex items-center justify-between border-b border-line px-4 py-3 text-xs"><strong className="text-navy">候補 {candidateData.candidates.total}件</strong><span className="text-muted">{candidateData.candidates.page}/{Math.max(Math.ceil(candidateData.candidates.total / candidateData.candidates.limit), 1)}ページ</span></div>
            <div className="divide-y divide-line">
              {candidateData.candidates.rows.map(({ problem, usageCount }) => <article className="p-4" key={problem.id}>
                <h3 className="text-sm font-bold leading-5 text-navy">{problem.title || problem.code}</h3>
                <p className="mt-1 text-[11px] text-muted">{problem.code} · {problem.field}{problem.subfield ? ` / ${problem.subfield}` : ""}</p>
                <p className="mt-2 text-xs font-bold text-muted">難易度 {problem.difficulty} · {problem.estimatedMinutes}分 · 使用{Number(usageCount)}回</p>
                <p className="mt-2 text-xs leading-5 text-ink">{excerpt(problem.statement, 120)}</p>
                <details className="mt-2"><summary className="cursor-pointer text-xs font-bold text-navy underline">全文を見る</summary><div className="mt-3 max-h-[55vh] overflow-y-auto border border-line bg-white p-3">{problem.imageUrl && <Image unoptimized src={problem.imageUrl} alt="問題図" width={700} height={400} className="mb-3 max-h-40 w-auto object-contain" />}<MathMarkdown source={problem.statement} /></div></details>
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><form action={assignProblemAction.bind(null, id, candidateData.slot.id, problem.id)}><button className="btn-primary w-full" type="submit">第{candidateData.slot.position}問に配置</button></form><Link aria-label="問題詳細を別画面で確認" className="btn-secondary px-3" href={`/admin/problems/${problem.id}`} target="_blank">詳細</Link></div>
              </article>)}
              {!candidateData.candidates.rows.length && <div className="p-8 text-center"><p className="text-sm font-bold text-navy">候補がありません</p><p className="mt-2 text-xs text-muted">条件を緩めて再検索してください。</p></div>}
            </div>
            {candidateData.candidates.total > candidateData.candidates.limit && <nav className="grid grid-cols-2 gap-2 border-t border-line p-3"><Link className={`btn-secondary ${candidateData.candidates.page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={candidatePageHref(candidateData.candidates.page - 1)}>← 前へ</Link><Link className={`btn-secondary ${candidateData.candidates.page * candidateData.candidates.limit >= candidateData.candidates.total ? "pointer-events-none opacity-40" : ""}`} href={candidatePageHref(candidateData.candidates.page + 1)}>次へ →</Link></nav>}
          </section> : <>
            <section className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3"><h2 className="text-sm font-bold text-navy">大問構成</h2><span className="text-xs text-muted">{assigned.length}/{data.items.length}問</span></header>
              <div className="divide-y divide-line">
                {data.items.map(({ item, problem }, index) => <div className="p-3" key={item.id}>
                  <div className="flex items-start gap-3">
                    <a className="grid size-8 shrink-0 place-items-center bg-navy text-xs font-bold text-white" href={`#preview-slot-${item.id}`}>{item.position}</a>
                    <div className="min-w-0 flex-1"><a className="block truncate text-sm font-bold text-navy" href={`#preview-slot-${item.id}`}>{problem?.title || problem?.code || "問題未選択"}</a><p className="mt-1 truncate text-[11px] text-muted">{problem ? `${problem.field} · 難易度${problem.difficulty} · ${problem.estimatedMinutes}分` : "候補から問題を配置してください"}</p></div>
                    <Link className="shrink-0 text-xs font-bold text-navy underline" href={`/admin/mocks/${id}?slot=${item.id}#workspace`}>{problem ? "変更" : "選ぶ"}</Link>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-1">
                    <form action={moveSlotProblemAction.bind(null, id, item.id, "up")}><button aria-label={`第${item.position}問を上へ`} className="border border-line bg-white px-2 py-1 text-xs text-navy disabled:opacity-30" disabled={index === 0} type="submit">↑</button></form>
                    <form action={moveSlotProblemAction.bind(null, id, item.id, "down")}><button aria-label={`第${item.position}問を下へ`} className="border border-line bg-white px-2 py-1 text-xs text-navy disabled:opacity-30" disabled={index === data.items.length - 1} type="submit">↓</button></form>
                    {problem && <form action={clearSlotAction.bind(null, id, item.id)}><button className="border border-line bg-white px-2 py-1 text-xs text-muted" type="submit">外す</button></form>}
                  </div>
                  <details className="mt-2"><summary className="cursor-pointer text-[11px] font-bold text-muted">自動選定条件</summary><form action={updateSlotFiltersAction.bind(null, id, item.id)} className="mt-3 space-y-2 border-t border-line pt-3"><label><span className="label text-[11px]">分野</span><select className="input" name="fieldFilter" defaultValue={item.fieldFilter || ""}><option value="">指定なし</option>{facets.fields.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span className="label text-[11px]">サブ分野</span><select className="input" name="subfieldFilter" defaultValue={item.subfieldFilter || ""}><option value="">指定なし</option>{facets.subfields.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label><span className="label text-[11px]">難易度 下限</span><select className="input" name="difficultyMin" defaultValue={item.difficultyMin || ""}><option value="">なし</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span className="label text-[11px]">難易度 上限</span><select className="input" name="difficultyMax" defaultValue={item.difficultyMax || ""}><option value="">なし</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" name="unusedOnly" defaultChecked={item.unusedOnly} />未使用のみ</label><button className="btn-secondary w-full" type="submit">条件を保存して候補表示</button></form></details>
                </div>)}
              </div>
              <div className="grid gap-2 border-t border-line p-3">
                {emptyCount > 0 && <form action={autoAssignEmptySlotsAction.bind(null, id)}><button className="btn-secondary w-full" type="submit">空欄を条件から仮配置</button></form>}
                <div className="grid grid-cols-2 gap-2"><form action={addMockSlotAction.bind(null, id)}><button className="btn-secondary w-full px-2" disabled={data.items.length >= 20} type="submit">大問を追加</button></form><form action={removeLastEmptyMockSlotAction.bind(null, id)}><button className="btn-secondary w-full px-2" disabled={data.items.length <= 1 || !lastSlotIsEmpty} type="submit">空欄を削除</button></form></div>
              </div>
            </section>

            <details className="card overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4"><span><strong className="block text-sm text-navy">模試・紙面設定</strong><span className="mt-1 block text-[11px] text-muted">{paper.paperSize} · {paper.fontSize}pt · 余白{paper.marginMm}mm · {paper.columns}段</span></span><span className="border border-line bg-surface px-2 py-1 text-[11px] font-bold text-navy">{mockStatusLabels[data.exam.status]}</span></summary>
              <form action={updateMockSettingsAction.bind(null, id)} className="space-y-3 border-t border-line p-4">
                <label><span className="label text-xs">タイトル</span><input className="input" name="title" required defaultValue={data.exam.title} /></label>
                <label><span className="label text-xs">科目</span><select className="input" name="subjectId" defaultValue={data.exam.subjectId || ""}><option value="">未設定</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
                <div className="grid grid-cols-2 gap-2"><label><span className="label text-xs">想定大学</span><input className="input" list="mock-university-options" name="targetUniversity" defaultValue={data.exam.targetUniversity || ""} /></label><label><span className="label text-xs">試験時間</span><input className="input" name="durationMinutes" type="number" min="1" max="600" defaultValue={data.exam.durationMinutes} /></label><label><span className="label text-xs">状態</span><select className="input" name="status" defaultValue={data.exam.status}><option value="DRAFT">編集中</option><option value="READY" disabled={!complete}>完成</option></select></label><label><span className="label text-xs">用紙</span><select className="input" name="paperSize" defaultValue={paper.paperSize}><option value="B5">B5</option><option value="A4">A4</option></select></label><label><span className="label text-xs">文字 pt</span><input className="input" name="fontSize" type="number" min="9" max="14" defaultValue={paper.fontSize} /></label><label><span className="label text-xs">余白 mm</span><input className="input" name="marginMm" type="number" min="8" max="35" defaultValue={paper.marginMm} /></label><label><span className="label text-xs">段組</span><select className="input" name="columns" defaultValue={String(paper.columns)}><option value="1">1段</option><option value="2">2段</option></select></label></div>
                <div className="space-y-2 text-xs"><label className="flex items-center gap-2"><input type="checkbox" name="showPageNumbers" defaultChecked={paper.showPageNumbers} />ページ番号</label><label className="flex items-center gap-2"><input type="checkbox" name="pageBreakPerProblem" defaultChecked={paper.pageBreakPerProblem} />問題ごとに改ページ</label></div>
                {!complete && <p className="border border-line bg-surface p-3 text-xs text-muted">全大問を配置すると「完成」にできます。</p>}
                <button className="btn-primary w-full" type="submit">設定を保存</button>
              </form>
            </details>

            <details className="card overflow-hidden"><summary className="cursor-pointer p-4 text-sm font-bold text-navy">Markdown・LaTeX出力</summary><div className="grid grid-cols-2 gap-2 border-t border-line p-4"><a className="btn-secondary" href={`/admin/mocks/${id}/export/markdown?mode=combined`}>Markdown</a><a className="btn-secondary" href={`/admin/mocks/${id}/export/latex?mode=combined`}>LaTeX</a></div></details>
            <form action={archiveMockExamAction.bind(null, id)}><button className="w-full border border-line bg-white px-4 py-3 text-xs font-bold text-muted" type="submit">模試をアーカイブ</button></form>
          </>}
        </aside>

        <main className={`${selectedItem ? "order-2" : "order-1"} min-w-0 xl:order-2`}>
          <section className="card overflow-hidden">
            <header className="flex flex-col gap-3 border-b border-line bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="text-sm font-bold text-navy">紙面プレビュー</h2><p className="mt-1 text-[11px] text-muted">{paper.paperSize} · {paper.fontSize}pt · 余白{paper.marginMm}mm · {paper.columns}段</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <nav aria-label="プレビュー内容" className="flex border border-line bg-surface p-0.5 text-xs font-bold"><Link className={`px-3 py-2 ${previewMode === "questions" ? "bg-white text-navy" : "text-muted"}`} href={hrefWith({ preview: undefined })}>問題</Link><Link className={`px-3 py-2 ${previewMode === "answers" ? "bg-white text-navy" : "text-muted"}`} href={hrefWith({ preview: "answers" })}>解答</Link><Link className={`px-3 py-2 ${previewMode === "combined" ? "bg-white text-navy" : "text-muted"}`} href={hrefWith({ preview: "combined" })}>問題＋解答</Link></nav>
                <Link className="btn-primary" href={`/admin/print/${id}?mode=${previewMode}`}>印刷画面を開く</Link>
              </div>
            </header>
            <div className="mock-preview-stage overflow-auto p-4 sm:p-6 lg:p-8">
              <ExamPaper activeItemId={selectedItem} className="mock-preview-paper mx-auto" data={data} editBasePath={`/admin/mocks/${id}`} mode={previewMode} />
            </div>
          </section>
        </main>
      </div>
    </div>
    <datalist id="mock-university-options">{facets.universities.map((value) => <option key={value} value={value} />)}</datalist>
  </>;
}
