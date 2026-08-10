import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addMockSlotAction,
  archiveMockExamAction,
  assignProblemFromFormAction,
  autoAssignEmptySlotsAction,
  clearSlotAction,
  duplicateMockExamAction,
  moveSlotProblemAction,
  removeLastEmptyMockSlotAction,
  updateMockSettingsAction,
  updateSlotFiltersAction,
} from "@/app/admin/author-actions";
import { CandidateFilterBar } from "@/components/candidate-filter-bar";
import { MathMarkdown } from "@/components/math-markdown";
import { MockWorkbench, type WorkbenchProblem } from "@/components/mock-workbench";
import { excerpt, getTimeBandRange, mockStatusLabels, timeBandOptions, verificationLabels } from "@/lib/authoring-labels";
import {
  getMathSubject,
  getMockCandidates,
  getMockExam,
  getProblemFacets,
  getUniversityDifficultyProfiles,
  getUsedProblemIds,
  type ProblemSearch,
  type UniversityDifficultyProfile,
} from "@/lib/data/authoring";
import type { Problem } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value || "";

function candidateDifficultyMode(query: Query) {
  const requested = one(query.candidateDifficultyMode);
  if (["all", "university-easier", "university-standard", "university-harder"].includes(requested)) return requested;
  if (/^exact-[1-5]$/.test(requested)) return requested;
  const legacyDifficulty = Number(one(query.candidateDifficulty));
  return legacyDifficulty >= 1 && legacyDifficulty <= 5 ? `exact-${legacyDifficulty}` : "all";
}

function candidateSearch(query: Query, universityProfiles: UniversityDifficultyProfile[]): ProblemSearch {
  const usage = one(query.candidateUsage);
  const verification = one(query.candidateVerification);
  const sort = one(query.candidateSort);
  const university = one(query.candidateUniversity) || undefined;
  const difficultyMode = candidateDifficultyMode(query);
  const profile = universityProfiles.find((item) => item.university === university);
  const exactDifficulty = difficultyMode.startsWith("exact-") ? Number(difficultyMode.slice(6)) : undefined;
  let difficultyMin = exactDifficulty;
  let difficultyMax = exactDifficulty;
  if (profile && difficultyMode === "university-standard") {
    difficultyMin = profile.baselineDifficulty;
    difficultyMax = profile.baselineDifficulty;
  } else if (profile && difficultyMode === "university-easier") {
    difficultyMax = profile.baselineDifficulty - 1;
  } else if (profile && difficultyMode === "university-harder") {
    difficultyMin = profile.baselineDifficulty + 1;
  }
  const timeBand = getTimeBandRange(one(query.candidateTimeBand));
  return {
    q: one(query.candidateQ) || undefined,
    field: one(query.candidateField) || undefined,
    subfield: one(query.candidateSubfield) || undefined,
    targetUniversity: university,
    difficultyMin,
    difficultyMax,
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
    limit: 12,
  };
}

// リストに1行だけ出す下読み用テキスト。数式は落として日本語の骨格を残す。
function candidateSnippet(statement: string) {
  const stripped = statement
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, "　")
    .replace(/\$[^$\n]*\$/g, "　")
    .replace(/\s+/g, " ")
    .trim();
  return excerpt(stripped.length >= 16 ? stripped : statement, 90);
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
  const [facets, universityProfiles] = mathSubject
    ? await Promise.all([
      getProblemFacets(mathSubject.id, one(query.candidateField) || undefined),
      getUniversityDifficultyProfiles(mathSubject.id),
    ])
    : [{ fields: [], subfields: [], universities: [] }, [] as UniversityDifficultyProfile[]];
  const filters = candidateSearch(query, universityProfiles);
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
  const activeSlot = data.items.find(({ item }) => item.id === selectedItem);
  const selectedUniversityProfile = universityProfiles.find((profile) => profile.university === one(query.candidateUniversity));

  const hrefWith = (updates: Record<string, string | undefined>) => {
    const url = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (typeof value === "string" && value) url.set(key, value);
    for (const [key, value] of Object.entries(updates)) {
      if (value) url.set(key, value);
      else url.delete(key);
    }
    const suffix = url.size ? `?${url.toString()}` : "";
    return `/admin/mocks/${id}${suffix}`;
  };

  const relativeNote = (problem: Problem) => {
    if (!selectedUniversityProfile || problem.targetUniversity !== selectedUniversityProfile.university) return null;
    if (problem.difficulty < selectedUniversityProfile.baselineDifficulty) return "大学基準より易しめ";
    if (problem.difficulty > selectedUniversityProfile.baselineDifficulty) return "大学基準より難しめ";
    return "大学標準";
  };

  const toWorkbenchProblem = (problem: Problem, usageCount: number | null): WorkbenchProblem => ({
    id: problem.id,
    title: problem.title || problem.code,
    code: problem.code,
    field: problem.field,
    subfield: problem.subfield,
    difficulty: problem.difficulty,
    minutes: problem.estimatedMinutes,
    usageCount,
    university: problem.targetUniversity,
    note: relativeNote(problem),
    snippet: candidateSnippet(problem.statement),
    href: `/admin/problems/${problem.id}`,
    body: <>
      {problem.imageUrl && <Image unoptimized src={problem.imageUrl} alt="問題図" width={900} height={600} className="mx-auto mb-6 max-h-80 w-auto object-contain" />}
      <MathMarkdown source={problem.statement} />
    </>,
  });

  const totalPages = candidateData ? Math.ceil(candidateData.candidates.total / candidateData.candidates.limit) : 0;
  const pager = candidateData && totalPages > 1 ? <nav className="flex shrink-0 items-center justify-between gap-2 border-t border-line bg-white px-3 py-2">
    <Link
      aria-disabled={candidateData.candidates.page <= 1}
      className={`wb-ghost ${candidateData.candidates.page <= 1 ? "pointer-events-none opacity-40" : ""}`}
      href={hrefWith({ candidatePage: String(candidateData.candidates.page - 1) })}
    >← 前へ</Link>
    <span className="text-[11px] tabular-nums text-muted">{candidateData.candidates.page} / {totalPages}</span>
    <Link
      aria-disabled={candidateData.candidates.page >= totalPages}
      className={`wb-ghost ${candidateData.candidates.page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
      href={hrefWith({ candidatePage: String(candidateData.candidates.page + 1) })}
    >次へ →</Link>
  </nav> : null;

  const settingsPanel = <>
    <form action={updateMockSettingsAction.bind(null, id)} className="space-y-2.5">
      <input name="subjectId" type="hidden" value={mathSubject?.id || data.exam.subjectId || ""} />
      <label><span className="label mb-1 text-[11px]">模試名</span><input className="input h-9 min-h-9 text-[13px]" name="title" required defaultValue={data.exam.title} /></label>
      <label><span className="label mb-1 text-[11px]">想定大学</span><select className="input h-9 min-h-9 text-[13px]" name="targetUniversity" defaultValue={data.exam.targetUniversity || ""}><option value="">指定なし</option>{facets.universities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2">
        <label><span className="label mb-1 text-[11px]">試験時間</span><input className="input h-9 min-h-9 text-[13px]" name="durationMinutes" type="number" min="1" max="600" defaultValue={data.exam.durationMinutes} /></label>
        <label><span className="label mb-1 text-[11px]">状態</span><select className="input h-9 min-h-9 text-[13px]" name="status" defaultValue={data.exam.status}><option value="DRAFT">編集中</option><option value="READY" disabled={!complete}>完成</option></select></label>
        <label><span className="label mb-1 text-[11px]">用紙</span><select className="input h-9 min-h-9 text-[13px]" name="paperSize" defaultValue={paper.paperSize}><option value="B5">B5</option><option value="A4">A4</option></select></label>
        <label><span className="label mb-1 text-[11px]">段組</span><select className="input h-9 min-h-9 text-[13px]" name="columns" defaultValue={String(paper.columns)}><option value="1">1段</option><option value="2">2段</option></select></label>
        <label><span className="label mb-1 text-[11px]">文字 pt</span><input className="input h-9 min-h-9 text-[13px]" name="fontSize" type="number" min="9" max="14" defaultValue={paper.fontSize} /></label>
        <label><span className="label mb-1 text-[11px]">余白 mm</span><input className="input h-9 min-h-9 text-[13px]" name="marginMm" type="number" min="8" max="35" defaultValue={paper.marginMm} /></label>
      </div>
      <div className="space-y-1.5 text-[12px]">
        <label className="flex items-center gap-2"><input type="checkbox" name="showPageNumbers" defaultChecked={paper.showPageNumbers} />ページ番号を入れる</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="pageBreakPerProblem" defaultChecked={paper.pageBreakPerProblem} />問題ごとに改ページ</label>
      </div>
      <button className="btn-primary h-9 min-h-9 w-full text-[13px]" type="submit">設定を保存</button>
    </form>
    <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
      <form action={duplicateMockExamAction.bind(null, id)}><button className="text-[11px] font-semibold text-navy underline underline-offset-4" type="submit">この模試を複製</button></form>
      <form action={archiveMockExamAction.bind(null, id)}><button className="text-[11px] text-muted underline underline-offset-4" type="submit">アーカイブ</button></form>
    </div>
  </>;

  // 採用や大問の切り替えでも絞り込みを保つための共通クエリ。
  const keepQuery = hrefWith({ slot: undefined, candidatePage: undefined }).split("?")[1] || "";

  return <div className="flex min-h-0 flex-col xl:h-screen" id="workspace">
    <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-white px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-[0.08em] text-muted">模試ビルダー</p>
        <h1 className="truncate text-[15px] font-bold text-navy">{data.exam.title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-muted">
        <span>配置 <strong className="tabular-nums text-navy">{assigned.length}/{data.items.length}</strong></span>
        <span>想定 <strong className="tabular-nums text-navy">{totalMinutes}分</strong></span>
        <span>平均難易度 <strong className="tabular-nums text-navy">{averageDifficulty ? averageDifficulty.toFixed(1) : "—"}</strong></span>
        {duplicateUse > 0 && <span>他模試と重複 <strong className="tabular-nums text-navy">{duplicateUse}問</strong></span>}
        <span className="h-1 w-20 overflow-hidden rounded-sm bg-slate-100"><span className="block h-full bg-navy" style={{ width: `${Math.round((assigned.length / Math.max(data.items.length, 1)) * 100)}%` }} /></span>
      </div>
      <span className="ml-auto shrink-0 border border-line bg-surface px-2 py-1 text-[11px] font-bold text-navy">{mockStatusLabels[data.exam.status]}</span>
    </header>

    {!mathSubject || !candidateData ? <div className="grid flex-1 place-items-center p-10 text-center">
      <div>
        <h2 className="font-bold text-navy">{mathSubject ? "大問を読み込めませんでした" : "数学科目が登録されていません"}</h2>
        <p className="mt-2 text-sm text-muted">{mathSubject ? "ページを再読み込みしてください。" : "DBセットアップを確認してください。"}</p>
      </div>
    </div> : <div className="grid min-h-0 flex-1 xl:grid-cols-[212px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b border-line bg-white xl:border-r xl:border-b-0">
        <div className="flex shrink-0 items-center justify-between px-3 py-2">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-muted">大問構成</p>
          <form action={addMockSlotAction.bind(null, id)}><button aria-label="大問を追加" className="wb-icon" disabled={data.items.length >= 20} type="submit">＋</button></form>
        </div>
        <ol className="wb-scroll flex-1 px-1.5 pb-2">
          {data.items.map(({ item, problem }, index) => {
            const active = selectedItem === item.id;
            return <li key={item.id}>
              <Link
                className={`flex items-start gap-2 rounded-md border-l-2 px-2 py-1.5 transition ${active ? "border-navy bg-blue-50" : "border-transparent hover:bg-surface"}`}
                href={hrefWith({ slot: item.id, candidatePage: undefined })}
              >
                <span className={`mt-px grid size-5 shrink-0 place-items-center rounded text-[10px] font-bold ${problem ? "bg-navy text-white" : "border border-dashed border-line text-muted"}`}>{item.position}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-semibold text-navy">{problem?.title || problem?.code || "未選択"}</span>
                  <span className="block truncate text-[10px] text-muted">{problem ? `難易度${problem.difficulty} · ${problem.estimatedMinutes}分` : "候補から選ぶ"}</span>
                </span>
              </Link>
              {active && <div className="mt-1 mb-2 ml-7 space-y-1.5">
                <div className="flex gap-1">
                  <form action={moveSlotProblemAction.bind(null, id, item.id, "up")}><button aria-label={`第${item.position}問を上へ`} className="wb-icon" disabled={index === 0} type="submit">↑</button></form>
                  <form action={moveSlotProblemAction.bind(null, id, item.id, "down")}><button aria-label={`第${item.position}問を下へ`} className="wb-icon" disabled={index === data.items.length - 1} type="submit">↓</button></form>
                </div>
                <details>
                  <summary className="cursor-pointer text-[10px] font-semibold text-muted">この大問の自動選定条件</summary>
                  <form action={updateSlotFiltersAction.bind(null, id, item.id)} className="mt-2 space-y-1.5">
                    <select aria-label="分野" className="input h-8 min-h-8 px-2 text-[11px]" name="fieldFilter" defaultValue={item.fieldFilter || ""}><option value="">分野を指定しない</option>{facets.fields.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                    <select aria-label="サブ分野" className="input h-8 min-h-8 px-2 text-[11px]" name="subfieldFilter" defaultValue={item.subfieldFilter || ""}><option value="">サブ分野を指定しない</option>{facets.subfields.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                    <select aria-label="難易度" className="input h-8 min-h-8 px-2 text-[11px]" name="difficultyMin" defaultValue={item.difficultyMin || ""}><option value="">難易度を指定しない</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>難易度{value}</option>)}</select>
                    <input name="difficultyMax" type="hidden" value={item.difficultyMin || ""} />
                    <select aria-label="使用履歴" className="input h-8 min-h-8 px-2 text-[11px]" name="unusedOnly" defaultValue={item.unusedOnly ? "true" : ""}><option value="">使用履歴を問わない</option><option value="true">未使用のみ</option></select>
                    <button className="btn-secondary h-8 min-h-8 w-full text-[11px]" type="submit">条件を保存</button>
                  </form>
                </details>
              </div>}
            </li>;
          })}
        </ol>
        <div className="shrink-0 space-y-1.5 border-t border-line p-2">
          {emptyCount > 0 && <form action={autoAssignEmptySlotsAction.bind(null, id)}><button className="btn-secondary h-8 min-h-8 w-full px-2 text-[12px]" type="submit">空欄を自動で仮配置</button></form>}
          {lastSlotIsEmpty && data.items.length > 1 && <form action={removeLastEmptyMockSlotAction.bind(null, id)}><button className="wb-ghost w-full" type="submit">末尾の空欄を削除</button></form>}
        </div>
      </aside>

      <MockWorkbench
        key={hrefWith({})}
        assignAction={assignProblemFromFormAction.bind(null, id)}
        assigned={activeSlot?.problem ? toWorkbenchProblem(activeSlot.problem, null) : null}
        candidates={candidateData.candidates.rows.map(({ problem, usageCount }) => toWorkbenchProblem(problem, Number(usageCount)))}
        clearAction={activeSlot?.problem ? clearSlotAction.bind(null, id, activeSlot.item.id) : null}
        emptyMessage="条件を1つ外すと、候補を広げられます。"
        keepQuery={keepQuery}
        filters={<CandidateFilterBar
          action={`/admin/mocks/${id}`}
          fields={facets.fields}
          resetHref={`/admin/mocks/${id}?slot=${candidateData.slot.id}`}
          resultCount={candidateData.candidates.total}
          selected={{
            keyword: one(query.candidateQ),
            university: one(query.candidateUniversity),
            field: one(query.candidateField),
            subfield: one(query.candidateSubfield),
            difficultyMode: candidateDifficultyMode(query),
            timeBand: one(query.candidateTimeBand),
            usage: one(query.candidateUsage),
            verification: one(query.candidateVerification),
            sort: candidateData.filters.sort || "least-used",
          }}
          slotId={candidateData.slot.id}
          subfields={facets.subfields}
          timeOptions={timeBandOptions.map(({ value, label }) => ({ value, label }))}
          universities={facets.universities}
          universityProfiles={universityProfiles}
          verificationOptions={Object.entries(verificationLabels).map(([value, label]) => ({ value, label }))}
        />}
        pager={pager}
        printHref={`/admin/print/${id}?mode=questions`}
        settings={settingsPanel}
        slot={{ id: candidateData.slot.id, position: candidateData.slot.position }}
      />
    </div>}
  </div>;
}
