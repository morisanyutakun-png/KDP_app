"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

type DifficultyCount = { difficulty: number; count: number };

export type CandidateUniversityProfile = {
  university: string;
  problemCount: number;
  averageDifficulty: number;
  baselineDifficulty: number;
  difficultyCounts: DifficultyCount[];
};

type FilterOption = { value: string; label: string };

type CandidateFilterBarProps = {
  action: string;
  slotId: string;
  fields: string[];
  subfields: string[];
  universities: string[];
  universityProfiles: CandidateUniversityProfile[];
  selected: {
    keyword: string;
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
  resetHref: string;
};

const exactDifficulties = [1, 2, 3, 4, 5] as const;

function countFor(profile: CandidateUniversityProfile, predicate: (difficulty: number) => boolean) {
  return profile.difficultyCounts.reduce((sum, item) => sum + (predicate(item.difficulty) ? item.count : 0), 0);
}

export function CandidateFilterBar({
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
  resetHref,
}: CandidateFilterBarProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const subfieldRef = useRef<HTMLSelectElement>(null);
  const difficultyRef = useRef<HTMLSelectElement>(null);
  const profile = universityProfiles.find((item) => item.university === selected.university);
  const hasFilters = Boolean(
    selected.keyword || selected.university || selected.field || selected.subfield
    || (selected.difficultyMode && selected.difficultyMode !== "all")
    || selected.timeBand || selected.usage || selected.verification,
  );

  // ページ全体を読み直さずに候補だけ差し替えるため、GETフォームを自前でURL化する。
  const submit = () => {
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value !== "string") continue;
      const cleaned = value.trim();
      if (!cleaned || cleaned === "all") continue;
      params.set(key, cleaned);
    }
    router.push(params.size ? `${action}?${params.toString()}` : action);
  };
  // 分野を変えるとサブ分野の選択肢が入れ替わるため、送信前に必ず解除する。
  const changeField = () => {
    if (subfieldRef.current) subfieldRef.current.value = "";
    submit();
  };
  // 大学基準の難易度は選択中の大学に紐づくので、大学を変えたら直接指定だけ残す。
  const changeUniversity = () => {
    if (difficultyRef.current?.value.startsWith("university-")) difficultyRef.current.value = "all";
    submit();
  };

  return (
    <form
      action={action}
      className="shrink-0 border-b border-line bg-white px-3 py-2.5"
      method="get"
      onSubmit={(event) => { event.preventDefault(); submit(); }}
      ref={formRef}
    >
      <input name="slot" type="hidden" value={slotId} />

      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">問題を検索</span>
          <svg aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" fill="none" height="14" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 16 16" width="14"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" strokeLinecap="round" /></svg>
          <input className="wb-search" defaultValue={selected.keyword} name="candidateQ" placeholder="キーワードで検索（問題文・コード）" type="search" />
        </label>
        <p aria-live="polite" className="shrink-0 text-[12px] text-muted"><strong className="text-[13px] tabular-nums text-navy">{resultCount.toLocaleString("ja-JP")}</strong> 件</p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <select aria-label="大学で絞り込む" className="pill" data-active={Boolean(selected.university)} defaultValue={selected.university} name="candidateUniversity" onChange={changeUniversity}>
          <option value="">大学</option>
          {universities.map((value) => {
            const item = universityProfiles.find((entry) => entry.university === value);
            return <option key={value} value={value}>{value}{item ? `（${item.problemCount}）` : ""}</option>;
          })}
        </select>

        <select aria-label="分野で絞り込む" className="pill" data-active={Boolean(selected.field)} defaultValue={selected.field} name="candidateField" onChange={changeField}>
          <option value="">分野</option>
          {fields.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>

        {Boolean(selected.field) && <select aria-label="サブ分野で絞り込む" className="pill" data-active={Boolean(selected.subfield)} defaultValue={selected.subfield} name="candidateSubfield" onChange={submit} ref={subfieldRef}>
          <option value="">サブ分野</option>
          {subfields.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>}

        <select aria-label="難易度で絞り込む" className="pill" data-active={selected.difficultyMode !== "all"} defaultValue={selected.difficultyMode} name="candidateDifficultyMode" onChange={submit} ref={difficultyRef}>
          <option value="all">難易度</option>
          {profile && <optgroup label={`${profile.university}の基準（標準は難易度${profile.baselineDifficulty}）`}>
            <option value="university-easier">易しめ · {countFor(profile, (value) => value < profile.baselineDifficulty)}問</option>
            <option value="university-standard">大学標準 · {countFor(profile, (value) => value === profile.baselineDifficulty)}問</option>
            <option value="university-harder">難しめ · {countFor(profile, (value) => value > profile.baselineDifficulty)}問</option>
          </optgroup>}
          <optgroup label="難易度を直接指定">
            {exactDifficulties.map((value) => <option key={value} value={`exact-${value}`}>難易度{value}</option>)}
          </optgroup>
        </select>

        <select aria-label="想定時間で絞り込む" className="pill" data-active={Boolean(selected.timeBand)} defaultValue={selected.timeBand} name="candidateTimeBand" onChange={submit}>
          <option value="">想定時間</option>
          {timeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        <select aria-label="使用履歴で絞り込む" className="pill" data-active={Boolean(selected.usage)} defaultValue={selected.usage} name="candidateUsage" onChange={submit}>
          <option value="">使用履歴</option>
          <option value="unused">未使用のみ</option>
          <option value="used">使用済みのみ</option>
        </select>

        <select aria-label="検証状態で絞り込む" className="pill" data-active={Boolean(selected.verification)} defaultValue={selected.verification} name="candidateVerification" onChange={submit}>
          <option value="">検証状態</option>
          {verificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>

        <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-line" />

        <select aria-label="並び順" className="pill pill-quiet" defaultValue={selected.sort} name="candidateSort" onChange={submit}>
          <option value="least-used">使用が少ない順</option>
          <option value="time-asc">短時間順</option>
          <option value="difficulty-asc">易しい順</option>
          <option value="difficulty-desc">難しい順</option>
          <option value="recent">更新が新しい順</option>
        </select>

        {hasFilters && <Link className="ml-auto shrink-0 px-1 text-[11px] font-semibold text-muted underline underline-offset-4 hover:text-navy" href={resetHref}>条件をクリア</Link>}
      </div>

      {profile && <p className="mt-2 text-[11px] leading-5 text-muted">{profile.university}の登録は{profile.problemCount}問・平均難易度{profile.averageDifficulty.toFixed(1)}。難易度{profile.baselineDifficulty}をこの大学の標準として扱います。</p>}

      <noscript><button className="btn-secondary mt-2" type="submit">条件を反映</button></noscript>
    </form>
  );
}
