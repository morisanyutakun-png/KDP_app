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
} from "@/app/admin/author-actions";
import { CandidateFilterBar } from "@/components/candidate-filter-bar";
import { MathMarkdown } from "@/components/math-markdown";
import { MockWorkbench, type WorkbenchProblem } from "@/components/mock-workbench";
import { Popover } from "@/components/popover";
import { mockStatusLabels, timeBandOptions, verificationLabels } from "@/lib/authoring-labels";
import { candidateDifficultyMode, parseCandidateFilters } from "@/lib/candidate-filters";
import {
  getMathSubject,
  getMockCandidates,
  getMockExam,
  getProblemFacets,
  getUniversityDifficultyProfiles,
  getUsedProblemIds,
  type UniversityDifficultyProfile,
} from "@/lib/data/authoring";
import type { Problem } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value || "";

export default async function MockBuilderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const read = (key: string) => one(query[key]);
  const [data, usedElsewhere, mathSubject] = await Promise.all([
    getMockExam(id),
    getUsedProblemIds(id),
    getMathSubject(),
  ]);
  if (!data) notFound();

  const requestedSlot = read("slot");
  const selectedItem = requestedSlot && data.items.some(({ item }) => item.id === requestedSlot)
    ? requestedSlot
    : data.items.find(({ problem }) => !problem)?.item.id || data.items[0]?.item.id;
  const [facets, universityProfiles] = mathSubject
    ? await Promise.all([
      getProblemFacets(mathSubject.id, read("candidateField") || undefined),
      getUniversityDifficultyProfiles(mathSubject.id),
    ])
    : [{ fields: [], subfields: [], universities: [] }, [] as UniversityDifficultyProfile[]];
  const filters = parseCandidateFilters(read, universityProfiles);
  const candidateData = selectedItem && mathSubject
    ? await getMockCandidates(id, selectedItem, { ...filters, subjectId: mathSubject.id })
    : null;
  const assigned = data.items.filter(({ problem }) => problem);
  const emptyCount = data.items.length - assigned.length;
  const totalMinutes = assigned.reduce((sum, { problem }) => sum + (problem?.estimatedMinutes || 0), 0);
  const averageDifficulty = assigned.length
    ? assigned.reduce((sum, { problem }) => sum + (problem?.difficulty || 0), 0) / assigned.length
    : 0;
  const complete = emptyCount === 0;
  const lastSlotIsEmpty = !data.items.at(-1)?.problem;
  const paper = data.exam.paperSettings;
  const activeSlot = data.items.find(({ item }) => item.id === selectedItem);
  const selectedUniversityProfile = universityProfiles.find((profile) => profile.university === read("candidateUniversity"));

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
  // 採用・自動配置・大問の切り替えでも絞り込みを保つための共通クエリ。
  const keepQuery = hrefWith({ slot: undefined, candidatePage: undefined }).split("?")[1] || "";
  const activeFilterCount = ["candidateQ", "candidateUniversity", "candidateField", "candidateSubfield", "candidateTimeBand", "candidateUsage", "candidateVerification"]
    .filter((key) => read(key)).length + (candidateDifficultyMode(read) === "all" ? 0 : 1);

  const relativeNote = (problem: Problem) => {
    if (!selectedUniversityProfile || problem.targetUniversity !== selectedUniversityProfile.university) return null;
    if (problem.difficulty < selectedUniversityProfile.baselineDifficulty) return "大学基準より易しめ";
    if (problem.difficulty > selectedUniversityProfile.baselineDifficulty) return "大学基準より難しめ";
    return "大学標準";
  };

  const toWorkbenchProblem = (problem: Problem, usageCount: number | null, note?: string | null): WorkbenchProblem => ({
    id: problem.id,
    title: problem.title || problem.code,
    code: problem.code,
    field: problem.field,
    subfield: problem.subfield,
    difficulty: problem.difficulty,
    minutes: problem.estimatedMinutes,
    usageCount,
    university: problem.targetUniversity,
    note: note ?? relativeNote(problem),
    href: `/admin/problems/${problem.id}`,
    body: <>
      {problem.imageUrl && <Image unoptimized src={problem.imageUrl} alt="問題図" width={900} height={600} className="mx-auto mb-6 max-h-80 w-auto object-contain" />}
      <MathMarkdown source={problem.statement} />
    </>,
  });

  const totalPages = candidateData ? Math.ceil(candidateData.candidates.total / candidateData.candidates.limit) : 0;
  const pager = candidateData && totalPages > 1 ? <nav className="flex shrink-0 items-center justify-between gap-2 border-t border-line bg-white px-3 py-1.5">
    <Link
      aria-disabled={candidateData.candidates.page <= 1}
      className={`wb-ghost ${candidateData.candidates.page <= 1 ? "pointer-events-none opacity-40" : ""}`}
      href={hrefWith({ candidatePage: String(candidateData.candidates.page - 1) })}
    >←</Link>
    <span className="text-[11px] tabular-nums text-muted">{candidateData.candidates.page} / {totalPages}</span>
    <Link
      aria-disabled={candidateData.candidates.page >= totalPages}
      className={`wb-ghost ${candidateData.candidates.page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
      href={hrefWith({ candidatePage: String(candidateData.candidates.page + 1) })}
    >→</Link>
  </nav> : null;

  const railNode = <>
    <div className="flex shrink-0 items-center justify-between px-2.5 py-2">
      <p className="wb-label">大問構成</p>
      <div className="flex gap-1">
        <form action={addMockSlotAction.bind(null, id)}><button aria-label="大問を追加" className="wb-icon" disabled={data.items.length >= 20} title="大問を追加" type="submit">＋</button></form>
        <form action={removeLastEmptyMockSlotAction.bind(null, id)}><button aria-label="末尾の空欄を削除" className="wb-icon" disabled={!lastSlotIsEmpty || data.items.length <= 1} title="末尾の空欄を削除" type="submit">−</button></form>
      </div>
    </div>
    <ol className="wb-scroll flex-1 px-1.5 pb-2">
      {data.items.map(({ item, problem }, index) => {
        const active = selectedItem === item.id;
        return <li className="group relative" key={item.id}>
          <Link
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition ${active ? "bg-blue-50" : "hover:bg-surface"}`}
            href={hrefWith({ slot: item.id, candidatePage: undefined })}
          >
            <span className={`grid size-5 shrink-0 place-items-center rounded text-[10px] font-bold ${problem ? "bg-navy text-white" : "border border-dashed border-line text-muted"}`}>{item.position}</span>
            <span className={`min-w-0 flex-1 truncate text-[12px] ${problem ? "font-semibold text-navy" : "text-muted"}`}>{problem ? problem.title || problem.code : "未配置"}</span>
            {problem && <span className="shrink-0 text-[10px] tabular-nums text-muted">{problem.estimatedMinutes}分</span>}
          </Link>
          <div className={`absolute top-1/2 right-1 hidden -translate-y-1/2 gap-0.5 rounded-md p-0.5 group-focus-within:flex group-hover:flex ${active ? "bg-blue-50" : "bg-white"}`}>
            <form action={moveSlotProblemAction.bind(null, id, item.id, "up")}><button aria-label={`第${item.position}問を上へ`} className="wb-icon" disabled={index === 0} title="上へ" type="submit">↑</button></form>
            <form action={moveSlotProblemAction.bind(null, id, item.id, "down")}><button aria-label={`第${item.position}問を下へ`} className="wb-icon" disabled={index === data.items.length - 1} title="下へ" type="submit">↓</button></form>
          </div>
        </li>;
      })}
    </ol>
    {emptyCount > 0 && <div className="shrink-0 border-t border-line p-2">
      <form action={autoAssignEmptySlotsAction.bind(null, id)}>
        <input name="keepQuery" type="hidden" value={keepQuery} />
        <button className="btn-secondary h-8 min-h-8 w-full px-2 text-[12px]" type="submit">この条件で空欄を埋める</button>
      </form>
    </div>}
  </>;

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

  return <div className="flex min-h-0 flex-col xl:h-screen" id="workspace">
    <header className="flex shrink-0 items-center gap-3 border-b border-line bg-white px-3 py-1.5">
      <Link className="wb-ghost shrink-0" href="/admin/mocks">← 一覧</Link>
      <h1 className="min-w-0 truncate text-[14px] font-bold text-navy">{data.exam.title}</h1>
      <p className="hidden shrink-0 text-[11px] text-muted sm:block">
        {assigned.length}/{data.items.length}問 · {totalMinutes}分{averageDifficulty ? ` · 平均難易度${averageDifficulty.toFixed(1)}` : ""}
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <span className="border border-line bg-surface px-2 py-1 text-[11px] font-bold text-navy">{mockStatusLabels[data.exam.status]}</span>
        <Popover label="紙面設定">{settingsPanel}</Popover>
        <Link className="wb-ghost" href={`/admin/print/${id}?mode=questions`}>最終紙面</Link>
      </div>
    </header>

    {!mathSubject || !candidateData ? <div className="grid flex-1 place-items-center p-10 text-center">
      <div>
        <h2 className="font-bold text-navy">{mathSubject ? "大問を読み込めませんでした" : "数学科目が登録されていません"}</h2>
        <p className="mt-2 text-sm text-muted">{mathSubject ? "ページを再読み込みしてください。" : "DBセットアップを確認してください。"}</p>
      </div>
    </div> : <MockWorkbench
      assignAction={assignProblemFromFormAction.bind(null, id)}
      assigned={activeSlot?.problem ? toWorkbenchProblem(activeSlot.problem, null, usedElsewhere.has(activeSlot.problem.id) ? "他の模試でも使用" : null) : null}
      candidates={candidateData.candidates.rows.map(({ problem, usageCount }) => toWorkbenchProblem(problem, Number(usageCount)))}
      clearAction={activeSlot?.problem ? clearSlotAction.bind(null, id, activeSlot.item.id) : null}
      emptyMessage="条件を1つ外すと、候補を広げられます。"
      filters={<CandidateFilterBar
        action={`/admin/mocks/${id}`}
        fields={facets.fields}
        selected={{
          keyword: read("candidateQ"),
          university: read("candidateUniversity"),
          field: read("candidateField"),
          subfield: read("candidateSubfield"),
          difficultyMode: candidateDifficultyMode(read),
          timeBand: read("candidateTimeBand"),
          usage: read("candidateUsage"),
          verification: read("candidateVerification"),
          sort: candidateData.filters.sort || "least-used",
        }}
        slotId={candidateData.slot.id}
        subfields={facets.subfields}
        timeOptions={timeBandOptions.map(({ value, label }) => ({ value, label }))}
        universities={facets.universities}
        universityProfiles={universityProfiles}
        verificationOptions={Object.entries(verificationLabels).map(([value, label]) => ({ value, label }))}
      />}
      keepQuery={keepQuery}
      listHeader={<>
        <p className="min-w-0 truncate text-[11px] text-muted">
          候補 <strong className="text-[12px] tabular-nums text-navy">{candidateData.candidates.total.toLocaleString("ja-JP")}</strong> 件
        </p>
        {activeFilterCount > 0 && <Link
          className="ml-auto shrink-0 text-[11px] font-semibold text-muted underline underline-offset-4 hover:text-navy"
          href={`/admin/mocks/${id}?slot=${candidateData.slot.id}`}
        >条件をクリア（{activeFilterCount}）</Link>}
      </>}
      pager={pager}
      rail={railNode}
      slot={{ id: candidateData.slot.id, position: candidateData.slot.position }}
    />}
  </div>;
}
