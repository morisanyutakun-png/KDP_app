"use client";

import { useRef, useState } from "react";

type DifficultyCount = { difficulty: number; count: number };

export type CandidateUniversityProfile = {
  university: string;
  problemCount: number;
  averageDifficulty: number;
  baselineDifficulty: number;
  difficultyCounts: DifficultyCount[];
};

type FilterOption = { value: string; label: string };
type ActiveFilter = { label: string; href: string };

type CandidateFilterPanelProps = {
  action: string;
  slotId: string;
  fields: string[];
  subfields: string[];
  universities: string[];
  universityProfiles: CandidateUniversityProfile[];
  selected: {
    university: string;
    field: string;
    subfield: string;
    difficultyMode: string;
    timeBand: string;
    usage: string;
    verification: string;
    sort: string;
  };
  timeOptions: FilterOption[];
  verificationOptions: FilterOption[];
  resultCount: number;
  activeFilters: ActiveFilter[];
  resetHref: string;
};

const exactDifficulties = [1, 2, 3, 4, 5] as const;

function countFor(profile: CandidateUniversityProfile, predicate: (difficulty: number) => boolean) {
  return profile.difficultyCounts.reduce(
    (sum, item) => sum + (predicate(item.difficulty) ? item.count : 0),
    0,
  );
}

export function CandidateFilterPanel({
  action,
  slotId,
  fields,
  subfields,
  universities,
  universityProfiles,
  selected,
  timeOptions,
  verificationOptions,
  resultCount,
  activeFilters,
  resetHref,
}: CandidateFilterPanelProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const subfieldRef = useRef<HTMLSelectElement>(null);
  const difficultyInputRef = useRef<HTMLInputElement>(null);
  const [difficultyMode, setDifficultyMode] = useState(selected.difficultyMode);
  const profileByUniversity = new Map(universityProfiles.map((profile) => [profile.university, profile]));
  const selectedProfile = profileByUniversity.get(selected.university);
  const hasAdvancedFilters = Boolean(selected.timeBand || selected.usage || selected.verification || selected.sort !== "least-used");

  const submit = () => formRef.current?.requestSubmit();
  const chooseDifficulty = (mode: string) => {
    if (difficultyInputRef.current) difficultyInputRef.current.value = mode;
    setDifficultyMode(mode);
    window.requestAnimationFrame(submit);
  };
  const changeUniversity = () => {
    if (!difficultyMode.startsWith("exact-") && difficultyInputRef.current) {
      difficultyInputRef.current.value = "all";
      setDifficultyMode("all");
    }
    submit();
  };
  const changeField = () => {
    if (subfieldRef.current) subfieldRef.current.value = "";
    submit();
  };

  const relativeOptions = selectedProfile ? [
    {
      value: "university-easier",
      label: "易しめ",
      detail: `難易度${Math.max(1, selectedProfile.baselineDifficulty - 1)}以下`,
      count: countFor(selectedProfile, (difficulty) => difficulty < selectedProfile.baselineDifficulty),
    },
    {
      value: "university-standard",
      label: "大学標準",
      detail: `難易度${selectedProfile.baselineDifficulty}`,
      count: countFor(selectedProfile, (difficulty) => difficulty === selectedProfile.baselineDifficulty),
    },
    {
      value: "university-harder",
      label: "難しめ",
      detail: `難易度${Math.min(5, selectedProfile.baselineDifficulty + 1)}以上`,
      count: countFor(selectedProfile, (difficulty) => difficulty > selectedProfile.baselineDifficulty),
    },
  ] : [];

  return (
    <form action={action} className="border-b border-line bg-white" method="get" ref={formRef}>
      <input name="slot" type="hidden" value={slotId} />
      <input defaultValue={difficultyMode} name="candidateDifficultyMode" ref={difficultyInputRef} type="hidden" />

      <div className="grid border-b border-line lg:grid-cols-[1.05fr_1fr]">
        <section className="border-b border-line p-5 lg:border-r lg:border-b-0 lg:p-6">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-sm bg-navy text-xs font-bold text-white">1</span>
            <div className="min-w-0 flex-1">
              <label className="block" htmlFor="candidate-university">
                <span className="block text-sm font-bold text-navy">まず、大学を選ぶ</span>
                <span className="mt-1 block text-xs leading-5 text-muted">大学の出題レベルに近い問題だけを表示します。</span>
              </label>
              <select
                className="input mt-3 min-h-12 text-[15px] font-semibold text-navy"
                defaultValue={selected.university}
                id="candidate-university"
                name="candidateUniversity"
                onChange={changeUniversity}
              >
                <option value="">すべての大学から探す</option>
                {universities.map((value) => {
                  const profile = profileByUniversity.get(value);
                  return <option key={value} value={value}>{value}{profile ? `（${profile.problemCount}問）` : ""}</option>;
                })}
              </select>

              {selectedProfile ? (
                <div className="mt-4 border-l-2 border-navy bg-surface px-3 py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-bold text-navy">{selectedProfile.university}の登録傾向</p>
                    <p className="text-[11px] text-muted">{selectedProfile.problemCount}問 · 平均 {selectedProfile.averageDifficulty.toFixed(1)}</p>
                  </div>
                  <div aria-label={`難易度${selectedProfile.baselineDifficulty}が大学標準です`} className="mt-2 grid grid-cols-5 gap-1">
                    {exactDifficulties.map((difficulty) => {
                      const count = selectedProfile.difficultyCounts.find((item) => item.difficulty === difficulty)?.count || 0;
                      const baseline = difficulty === selectedProfile.baselineDifficulty;
                      return <div className={`border px-1 py-1 text-center text-[10px] ${baseline ? "border-navy bg-navy font-bold text-white" : "border-line bg-white text-muted"}`} key={difficulty}><span className="block">{difficulty}</span><span className="block opacity-80">{count}問</span></div>;
                    })}
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-muted">平均に最も近い難易度{selectedProfile.baselineDifficulty}を、この大学の標準として扱います。</p>
                </div>
              ) : (
                <p className="mt-3 text-[11px] leading-5 text-muted">大学を選ぶと、登録問題から大学別の標準難易度を自動計算します。</p>
              )}
            </div>
          </div>
        </section>

        <section className="p-5 lg:p-6">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-sm border border-navy bg-white text-xs font-bold text-navy">2</span>
            <div className="min-w-0 flex-1">
              <div>
                <p className="text-sm font-bold text-navy">次に、出題分野を選ぶ</p>
                <p className="mt-1 text-xs leading-5 text-muted">分野だけでも探せます。サブ分野は必要なときだけ指定します。</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="label text-xs">分野</span>
                  <select className="input min-h-12" defaultValue={selected.field} name="candidateField" onChange={changeField}>
                    <option value="">すべての分野</option>
                    {fields.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label>
                  <span className="label text-xs">サブ分野</span>
                  <select className="input min-h-12" defaultValue={selected.subfield} name="candidateSubfield" onChange={submit} ref={subfieldRef}>
                    <option value="">指定しない</option>
                    {subfields.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="border-b border-line p-5 lg:p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-sm border border-navy bg-white text-xs font-bold text-navy">3</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-navy">最後に、難易度を選ぶ</p>
            <p className="mt-1 text-xs leading-5 text-muted">大学基準か、難易度1〜5の直接指定のどちらか一方を選びます。</p>

            <div className="mt-4 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
              <fieldset>
                <legend className="text-xs font-bold text-ink">大学基準から選ぶ</legend>
                {selectedProfile ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <button
                      aria-pressed={difficultyMode === "all"}
                      className={`min-h-14 border px-2 py-2 text-left transition ${difficultyMode === "all" ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
                      onClick={() => chooseDifficulty("all")}
                      type="button"
                    >
                      <span className="block text-xs font-bold">全難易度</span>
                      <span className={`mt-1 block text-[10px] ${difficultyMode === "all" ? "text-white/75" : "text-muted"}`}>{selectedProfile.problemCount}問</span>
                    </button>
                    {relativeOptions.map((option) => {
                      const selectedOption = difficultyMode === option.value;
                      return <button
                        aria-pressed={selectedOption}
                        className={`min-h-14 border px-2 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${selectedOption ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
                        disabled={option.count === 0}
                        key={option.value}
                        onClick={() => chooseDifficulty(option.value)}
                        type="button"
                      >
                        <span className="block text-xs font-bold">{option.label}</span>
                        <span className={`mt-1 block text-[10px] ${selectedOption ? "text-white/75" : "text-muted"}`}>{option.detail} · {option.count}問</span>
                      </button>;
                    })}
                  </div>
                ) : (
                  <div className="mt-2 grid min-h-14 place-items-center border border-dashed border-line bg-surface px-4 text-center text-xs text-muted">先に大学を選ぶと使えます</div>
                )}
              </fieldset>

              <fieldset>
                <legend className="text-xs font-bold text-ink">難易度を直接指定</legend>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {exactDifficulties.map((difficulty) => {
                    const mode = `exact-${difficulty}`;
                    const selectedOption = difficultyMode === mode;
                    return <button
                      aria-label={`難易度${difficulty}に絞り込む`}
                      aria-pressed={selectedOption}
                      className={`grid min-h-14 place-items-center border text-sm font-bold transition ${selectedOption ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}
                      key={difficulty}
                      onClick={() => chooseDifficulty(mode)}
                      type="button"
                    >{difficulty}</button>;
                  })}
                </div>
                <button className="mt-2 text-[11px] font-semibold text-muted underline underline-offset-4" onClick={() => chooseDifficulty("all")} type="button">難易度指定を外す</button>
              </fieldset>
            </div>
          </div>
        </div>
      </section>

      <details className="border-b border-line" open={hasAdvancedFilters}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-xs font-bold text-navy lg:px-6">
          <span>さらに絞る <span className="ml-1 font-normal text-muted">時間・使用履歴・検証状態</span></span>
          <span aria-hidden="true" className="text-base">⌄</span>
        </summary>
        <div className="grid gap-3 border-t border-line bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4 lg:p-6">
          <label><span className="label text-xs">想定時間</span><select className="input" defaultValue={selected.timeBand} name="candidateTimeBand" onChange={submit}><option value="">すべて</option>{timeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span className="label text-xs">使用履歴</span><select className="input" defaultValue={selected.usage} name="candidateUsage" onChange={submit}><option value="">すべて</option><option value="unused">未使用のみ</option><option value="used">使用済みのみ</option></select></label>
          <label><span className="label text-xs">検証状態</span><select className="input" defaultValue={selected.verification} name="candidateVerification" onChange={submit}><option value="">すべて</option>{verificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span className="label text-xs">並び順</span><select className="input" defaultValue={selected.sort} name="candidateSort" onChange={submit}><option value="least-used">使用回数が少ない順</option><option value="time-asc">短時間順</option><option value="difficulty-asc">易しい順</option><option value="difficulty-desc">難しい順</option><option value="recent">更新が新しい順</option></select></label>
        </div>
      </details>

      <footer className="flex flex-col gap-3 bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="min-w-0">
          <p aria-live="polite" className="text-sm font-bold text-navy"><span className="text-lg tabular-nums">{resultCount.toLocaleString("ja-JP")}</span> 問から選べます</p>
          {activeFilters.length ? <div aria-label="適用中の条件" className="mt-2 flex flex-wrap gap-1.5">{activeFilters.map((filter) => <a className="border border-line bg-white px-2 py-1 text-[11px] font-semibold text-navy hover:border-navy" href={filter.href} key={`${filter.label}-${filter.href}`}>{filter.label}<span aria-hidden="true" className="ml-1 text-muted">×</span></a>)}</div> : <p className="mt-1 text-[11px] text-muted">条件を変更すると自動で結果に反映されます。</p>}
        </div>
        {activeFilters.length > 0 && <a className="shrink-0 text-xs font-bold text-muted underline underline-offset-4" href={resetHref}>条件をすべて解除</a>}
      </footer>

      <noscript><div className="border-t border-line p-4"><button className="btn-primary" type="submit">条件を反映</button></div></noscript>
    </form>
  );
}
