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
  return {
    q: one(query.candidateQ) || undefined,
    field: one(query.candidateField) || undefined,
    subfield: one(query.candidateSubfield) || undefined,
    targetUniversity: one(query.candidateUniversity) || undefined,
    difficultyMin: Number(one(query.candidateDifficultyMin)) || undefined,
    difficultyMax: Number(one(query.candidateDifficultyMax)) || undefined,
    timeMax: Number(one(query.candidateTimeMax)) || undefined,
    usage: usage === "used" || usage === "unused" ? usage : undefined,
    verification: ["DRAFT", "REVIEWING", "VERIFIED", "NEEDS_REVISION"].includes(verification)
      ? verification as ProblemSearch["verification"]
      : undefined,
    ignoreExamTarget: one(query.candidateAllUniversities) === "1",
    page: Number(one(query.candidatePage)) || 1,
  };
}

export default async function MockBuilderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [data, usedElsewhere, facets, subjects] = await Promise.all([
    getMockExam(id),
    getUsedProblemIds(id),
    getProblemFacets(),
    getSubjects(),
  ]);
  if (!data) notFound();

  const requestedSlot = one(query.slot);
  const selectedItem = requestedSlot && data.items.some(({ item }) => item.id === requestedSlot) ? requestedSlot : undefined;
  const candidateData = selectedItem ? await getMockCandidates(id, selectedItem, candidateSearch(query)) : null;
  const assigned = data.items.filter(({ problem }) => problem);
  const emptyCount = data.items.length - assigned.length;
  const totalMinutes = assigned.reduce((sum, { problem }) => sum + (problem?.estimatedMinutes || 0), 0);
  const averageDifficulty = assigned.length
    ? assigned.reduce((sum, { problem }) => sum + (problem?.difficulty || 0), 0) / assigned.length
    : 0;
  const fields = Object.entries(assigned.reduce<Record<string, number>>((map, { problem }) => {
    if (problem) map[problem.field] = (map[problem.field] || 0) + 1;
    return map;
  }, {}));
  const duplicateUse = assigned.filter(({ problem }) => problem && usedElsewhere.has(problem.id)).length;
  const paper = data.exam.paperSettings;
  const complete = emptyCount === 0;
  const lastSlotIsEmpty = !data.items.at(-1)?.problem;

  const candidatePageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (key !== "candidatePage" && typeof value === "string" && value) params.set(key, value);
    }
    params.set("candidatePage", String(page));
    return `/admin/mocks/${id}?${params.toString()}#candidates`;
  };

  return <>
    <AdminPageHeader
      eyebrow="模試制作"
      title={data.exam.title}
      description={`${data.subjectName || "科目未設定"} · ${data.exam.durationMinutes}分 · ${data.exam.questionCount}問`}
      action={<div className="flex flex-wrap gap-2">
        <form action={duplicateMockExamAction.bind(null, id)}><button className="btn-secondary" type="submit">複製して編集</button></form>
        <Link className="btn-secondary" href={`/admin/print/${id}?mode=questions`}>紙面プレビュー</Link>
        <a className="btn-primary" href={`/admin/mocks/${id}/export/latex?mode=combined`}>LaTeX出力</a>
      </div>}
    />

    <div className="workbench space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card p-4"><p className="text-xs font-bold text-muted">配置状況</p><p className="mt-1 text-2xl font-bold text-navy">{assigned.length} / {data.items.length}</p><p className="mt-1 text-xs text-muted">{complete ? "全大問を配置済み" : `残り${emptyCount}問`}</p></div>
        <div className="card p-4"><p className="text-xs font-bold text-muted">合計想定時間</p><p className="mt-1 text-2xl font-bold text-navy">{totalMinutes}分</p><p className="mt-1 text-xs text-muted">試験時間との差 {totalMinutes - data.exam.durationMinutes >= 0 ? "+" : ""}{totalMinutes - data.exam.durationMinutes}分</p></div>
        <div className="card p-4"><p className="text-xs font-bold text-muted">平均難易度</p><p className="mt-1 text-2xl font-bold text-navy">{averageDifficulty ? averageDifficulty.toFixed(1) : "—"}</p><p className="mt-1 text-xs text-muted">5段階</p></div>
        <div className="card p-4"><p className="text-xs font-bold text-muted">分野構成</p><div className="mt-2 flex flex-wrap gap-1">{fields.length ? fields.map(([name, count]) => <span className="border border-line bg-surface px-2 py-1 text-xs font-bold text-navy" key={name}>{name} {count}</span>) : <span className="text-sm text-muted">未配置</span>}</div></div>
        <div className={`card p-4 ${duplicateUse ? "border-slate-400" : ""}`}><p className="text-xs font-bold text-muted">他の模試でも使用</p><p className="mt-1 text-2xl font-bold text-navy">{duplicateUse}問</p><p className="mt-1 text-xs text-muted">同一模試内の重複は防止</p></div>
      </section>

      <section className="card flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="font-bold text-navy">構成操作</h2><p className="mt-1 text-xs text-muted">各大問の条件を保存して選ぶか、空欄だけを条件に沿って仮配置できます。</p></div>
        <div className="flex flex-wrap gap-2">
          {emptyCount > 0 && <form action={autoAssignEmptySlotsAction.bind(null, id)}><button className="btn-primary" type="submit">空欄を条件から仮配置</button></form>}
          <form action={addMockSlotAction.bind(null, id)}><button className="btn-secondary" disabled={data.items.length >= 20} type="submit">大問を追加</button></form>
          <form action={removeLastEmptyMockSlotAction.bind(null, id)}><button className="btn-secondary" disabled={data.items.length <= 1 || !lastSlotIsEmpty} title={!lastSlotIsEmpty ? "末尾の問題を外すと削除できます" : undefined} type="submit">末尾の空欄を削除</button></form>
        </div>
      </section>

      {candidateData && <section className="card overflow-hidden border-slate-400" id="candidates">
        <div className="flex flex-col gap-3 border-b border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="eyebrow">第{candidateData.slot.position}問</p><h2 className="font-bold text-navy">候補問題を検索・比較</h2><p className="mt-1 text-xs text-muted">模試の科目・大学を初期条件にし、配置済み問題は候補から除外しています。</p></div>
          <Link className="btn-secondary" href={`/admin/mocks/${id}#slot-${candidateData.slot.id}`}>候補を閉じる</Link>
        </div>
        <form className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6" method="get">
          <input name="slot" type="hidden" value={candidateData.slot.id} />
          <label className="sm:col-span-2"><span className="label text-xs">キーワード</span><input className="input" name="candidateQ" defaultValue={candidateData.filters.q || ""} placeholder="タイトル・ID・本文" /></label>
          <label><span className="label text-xs">分野</span><input className="input" list="mock-field-options" name="candidateField" defaultValue={candidateData.filters.field || ""} placeholder="指定なし" /></label>
          <label><span className="label text-xs">サブ分野</span><input className="input" name="candidateSubfield" defaultValue={candidateData.filters.subfield || ""} placeholder="指定なし" /></label>
          <label><span className="label text-xs">想定大学</span><input className="input" disabled={candidateData.filters.ignoreExamTarget} list="mock-university-options" name="candidateUniversity" defaultValue={candidateData.filters.targetUniversity || ""} /></label>
          <label><span className="label text-xs">想定時間（最大）</span><input className="input" min="1" name="candidateTimeMax" type="number" defaultValue={candidateData.filters.timeMax || ""} /></label>
          <label><span className="label text-xs">難易度 下限</span><select className="input" name="candidateDifficultyMin" defaultValue={candidateData.filters.difficultyMin || ""}><option value="">なし</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span className="label text-xs">難易度 上限</span><select className="input" name="candidateDifficultyMax" defaultValue={candidateData.filters.difficultyMax || ""}><option value="">なし</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span className="label text-xs">使用履歴</span><select className="input" name="candidateUsage" defaultValue={candidateData.filters.usage || ""}><option value="">すべて</option><option value="unused">未使用のみ</option><option value="used">使用済みのみ</option></select></label>
          <label><span className="label text-xs">検証状態</span><select className="input" name="candidateVerification" defaultValue={candidateData.filters.verification || ""}><option value="">すべて</option>{Object.entries(verificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="flex min-h-10 items-end gap-2 pb-2 text-xs font-bold"><input name="candidateAllUniversities" type="checkbox" value="1" defaultChecked={candidateData.filters.ignoreExamTarget} />大学条件を使わない</label>
          <div className="flex items-end gap-2"><button className="btn-primary flex-1" type="submit">候補を絞り込む</button><Link className="btn-secondary" href={`/admin/mocks/${id}?slot=${candidateData.slot.id}`}>条件を戻す</Link></div>
        </form>
        <div className="border-b border-line px-5 py-3 text-sm"><strong className="text-navy">{candidateData.candidates.total}件</strong><span className="ml-2 text-xs text-muted">科目：{data.subjectName || "すべて"}</span></div>
        <div className="divide-y divide-line">
          {candidateData.candidates.rows.map(({ problem, subjectName, usageCount }) => <article key={problem.id} className="grid gap-4 p-5 xl:grid-cols-[1fr_170px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><strong className="text-navy">{problem.title || problem.code}</strong><span className="text-[11px] text-muted">{problem.code}</span><span className="border border-line bg-surface px-2 py-1 text-xs font-bold">{subjectName || "未分類"} / {problem.field}</span></div>
              <p className="mt-2 text-xs font-bold text-muted">難易度 {problem.difficulty} · {problem.estimatedMinutes}分 · 使用{Number(usageCount)}回 · {verificationLabels[problem.verificationStatus]}{problem.targetUniversity ? ` · ${problem.targetUniversity}` : ""}</p>
              <p className="mt-3 text-sm leading-6 text-ink">{excerpt(problem.statement, 260)}</p>
              <details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-brand-blue">問題全文をプレビュー</summary><div className="mt-3 max-h-96 overflow-y-auto border border-line bg-white p-4">{problem.imageUrl && <Image unoptimized src={problem.imageUrl} alt="問題図" width={700} height={400} className="mb-4 max-h-52 w-auto object-contain" />}<MathMarkdown source={problem.statement} /></div></details>
            </div>
            <div className="flex flex-col justify-center gap-2"><form action={assignProblemAction.bind(null, id, candidateData.slot.id, problem.id)}><button className="btn-primary w-full" type="submit">第{candidateData.slot.position}問に配置</button></form><Link className="btn-secondary" href={`/admin/problems/${problem.id}`} target="_blank">詳細を別画面で確認</Link></div>
          </article>)}
          {!candidateData.candidates.rows.length && <div className="p-10 text-center"><h3 className="font-bold text-navy">条件に合う問題がありません</h3><p className="mt-2 text-sm text-muted">大学・分野・未使用条件のいずれかを緩めてください。</p></div>}
        </div>
        {candidateData.candidates.total > candidateData.candidates.limit && <nav className="flex items-center justify-center gap-3 border-t border-line p-4"><Link className={`btn-secondary ${candidateData.candidates.page <= 1 ? "pointer-events-none opacity-40" : ""}`} href={candidatePageHref(candidateData.candidates.page - 1)}>← 前へ</Link><span className="text-sm font-bold text-muted">{candidateData.candidates.page} / {Math.ceil(candidateData.candidates.total / candidateData.candidates.limit)}</span><Link className={`btn-secondary ${candidateData.candidates.page * candidateData.candidates.limit >= candidateData.candidates.total ? "pointer-events-none opacity-40" : ""}`} href={candidatePageHref(candidateData.candidates.page + 1)}>次へ →</Link></nav>}
      </section>}

      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-4">
          {data.items.map(({ item, problem, subjectName }, index) => <article id={`slot-${item.id}`} key={item.id} className={`card scroll-mt-5 overflow-hidden ${selectedItem === item.id ? "border-slate-500" : ""}`}>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
              <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center bg-navy text-sm font-bold text-white">{item.position}</span><div className="min-w-0"><h2 className="font-bold text-navy">第{item.position}問</h2><p className="truncate text-xs text-muted">{problem ? `${problem.code} · ${problem.title || problem.field}` : "問題未選択"}</p></div></div>
              <div className="flex flex-wrap gap-2"><form action={moveSlotProblemAction.bind(null, id, item.id, "up")}><button className="btn-secondary min-h-9 px-3 py-1 text-xs" disabled={index === 0} title="上へ移動" type="submit">↑</button></form><form action={moveSlotProblemAction.bind(null, id, item.id, "down")}><button className="btn-secondary min-h-9 px-3 py-1 text-xs" disabled={index === data.items.length - 1} title="下へ移動" type="submit">↓</button></form>{problem && <form action={clearSlotAction.bind(null, id, item.id)}><button className="btn-secondary min-h-9 px-3 py-1 text-xs" type="submit">外す</button></form>}<Link className="btn-primary min-h-9 px-3 py-1 text-xs" href={`/admin/mocks/${id}?slot=${item.id}#candidates`}>{problem ? "差し替える" : "候補を選ぶ"}</Link></div>
            </header>
            {problem ? <div className="p-5"><div className="mb-3 flex flex-wrap gap-2 text-xs font-bold"><span>{subjectName || "未分類"} / {problem.field}{problem.subfield ? ` / ${problem.subfield}` : ""}</span><span className="text-muted">難易度 {problem.difficulty} · {problem.estimatedMinutes}分 · {verificationLabels[problem.verificationStatus]}</span>{usedElsewhere.has(problem.id) && <span className="text-muted">他の模試でも使用済み</span>}</div>{problem.imageUrl && <Image unoptimized src={problem.imageUrl} alt="問題図" width={700} height={400} className="mb-4 max-h-48 w-auto object-contain" />}<details><summary className="cursor-pointer text-sm font-bold text-brand-blue">問題本文を確認</summary><MathMarkdown className="mt-4 max-h-96 overflow-y-auto border border-line p-4" source={problem.statement} /></details></div> : <div className="p-5"><p className="text-sm text-muted">候補条件を設定してから「候補を選ぶ」を押すと、登録済みの問題を比較できます。</p></div>}
            <details className="border-t border-line" open={!problem && selectedItem === item.id}><summary className="cursor-pointer px-5 py-3 text-xs font-bold text-muted">この大問の候補条件</summary><form action={updateSlotFiltersAction.bind(null, id, item.id)} className="grid gap-3 border-t border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5"><label><span className="label text-xs">分野</span><input className="input" list="mock-field-options" name="fieldFilter" defaultValue={item.fieldFilter || ""} placeholder="指定なし" /></label><label><span className="label text-xs">サブ分野</span><input className="input" name="subfieldFilter" defaultValue={item.subfieldFilter || ""} placeholder="指定なし" /></label><label><span className="label text-xs">難易度 下限</span><select className="input" name="difficultyMin" defaultValue={item.difficultyMin || ""}><option value="">なし</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span className="label text-xs">難易度 上限</span><select className="input" name="difficultyMax" defaultValue={item.difficultyMax || ""}><option value="">なし</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div className="flex items-end gap-2"><label className="flex min-h-10 items-center gap-2 text-xs font-bold"><input type="checkbox" name="unusedOnly" defaultChecked={item.unusedOnly} />未使用のみ</label><button className="btn-primary min-h-10 px-3 text-xs" type="submit">保存して候補表示</button></div></form></details>
          </article>)}
        </main>

        <aside className="space-y-5 2xl:sticky 2xl:top-6">
          <form action={updateMockSettingsAction.bind(null, id)} className="card space-y-4 p-5"><div className="flex items-center justify-between"><h2 className="font-bold text-navy">模試・紙面設定</h2><span className="border border-line bg-surface px-2.5 py-1 text-xs font-bold text-navy">{mockStatusLabels[data.exam.status]}</span></div><label><span className="label text-xs">タイトル</span><input className="input" name="title" required defaultValue={data.exam.title} /></label><label><span className="label text-xs">科目</span><select className="input" name="subjectId" defaultValue={data.exam.subjectId || ""}><option value="">未設定</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label><span className="label text-xs">想定大学</span><input className="input" list="mock-university-options" name="targetUniversity" defaultValue={data.exam.targetUniversity || ""} /></label><label><span className="label text-xs">試験時間</span><input className="input" name="durationMinutes" type="number" min="1" max="600" defaultValue={data.exam.durationMinutes} /></label><label><span className="label text-xs">状態</span><select className="input" name="status" defaultValue={data.exam.status}><option value="DRAFT">編集中</option><option value="READY" disabled={!complete}>完成</option></select></label><label><span className="label text-xs">用紙</span><select className="input" name="paperSize" defaultValue={paper.paperSize}><option value="B5">B5</option><option value="A4">A4</option></select></label><label><span className="label text-xs">文字 pt</span><input className="input" name="fontSize" type="number" min="9" max="14" defaultValue={paper.fontSize} /></label><label><span className="label text-xs">余白 mm</span><input className="input" name="marginMm" type="number" min="8" max="35" defaultValue={paper.marginMm} /></label><label><span className="label text-xs">段組</span><select className="input" name="columns" defaultValue={String(paper.columns)}><option value="1">1段</option><option value="2">2段</option></select></label></div><div className="space-y-2 text-xs"><label className="flex items-center gap-2"><input type="checkbox" name="showPageNumbers" defaultChecked={paper.showPageNumbers} />ページ番号</label><label className="flex items-center gap-2"><input type="checkbox" name="pageBreakPerProblem" defaultChecked={paper.pageBreakPerProblem} />問題ごとに改ページ</label></div>{!complete && <p className="border border-line bg-surface p-3 text-xs text-muted">全大問を配置すると状態を「完成」にできます。</p>}<button className="btn-primary w-full" type="submit">設定を保存</button></form>
          <section className="card p-5"><h2 className="font-bold text-navy">確認・出力</h2><div className="mt-4 grid gap-2"><Link className="btn-secondary" href={`/admin/print/${id}?mode=questions`}>問題冊子をプレビュー</Link><Link className="btn-secondary" href={`/admin/print/${id}?mode=answers`}>解答冊子をプレビュー</Link><Link className="btn-secondary" href={`/admin/print/${id}?mode=combined`}>問題＋解答をプレビュー</Link></div><div className="mt-5 border-t border-line pt-4"><p className="mb-2 text-xs font-bold text-muted">Markdown</p><div className="grid grid-cols-3 gap-1"><a className="border border-line bg-surface px-2 py-2 text-center text-xs font-bold" href={`/admin/mocks/${id}/export/markdown?mode=questions`}>問題</a><a className="border border-line bg-surface px-2 py-2 text-center text-xs font-bold" href={`/admin/mocks/${id}/export/markdown?mode=answers`}>解答</a><a className="border border-line bg-surface px-2 py-2 text-center text-xs font-bold" href={`/admin/mocks/${id}/export/markdown?mode=combined`}>両方</a></div><p className="mt-3 mb-2 text-xs font-bold text-muted">LaTeX</p><div className="grid grid-cols-3 gap-1"><a className="border border-line bg-surface px-2 py-2 text-center text-xs font-bold" href={`/admin/mocks/${id}/export/latex?mode=questions`}>問題</a><a className="border border-line bg-surface px-2 py-2 text-center text-xs font-bold" href={`/admin/mocks/${id}/export/latex?mode=answers`}>解答</a><a className="border border-line bg-surface px-2 py-2 text-center text-xs font-bold" href={`/admin/mocks/${id}/export/latex?mode=combined`}>両方</a></div></div></section>
          <form action={archiveMockExamAction.bind(null, id)}><button className="w-full border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700" type="submit">模試をアーカイブ</button></form>
        </aside>
      </div>
    </div>
    <datalist id="mock-field-options">{facets.fields.map((value) => <option key={value} value={value} />)}</datalist>
    <datalist id="mock-university-options">{facets.universities.map((value) => <option key={value} value={value} />)}</datalist>
  </>;
}
