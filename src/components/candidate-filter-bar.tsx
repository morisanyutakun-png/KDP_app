"use client";

import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";

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
};

const exactDifficulties = [1, 2, 3, 4, 5] as const;

function countFor(profile: CandidateUniversityProfile, predicate: (difficulty: number) => boolean) {
  return profile.difficultyCounts.reduce((sum, item) => sum + (predicate(item.difficulty) ? item.count : 0), 0);
}

function Cell({ label, active, children }: { label: string; active: boolean; children: ReactNode }) {
  return <label className="wb-cell" data-active={active}>
    <span>{label}</span>
    {children}
  </label>;
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
}: CandidateFilterBarProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const subfieldRef = useRef<HTMLSelectElement>(null);
  const difficultyRef = useRef<HTMLSelectElement>(null);
  const profile = universityProfiles.find((item) => item.university === selected.university);
  const detailOpen = Boolean(selected.subfield || selected.verification);

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
      className="shrink-0 space-y-2 border-b border-line bg-white p-3"
      method="get"
      onSubmit={(event) => { event.preventDefault(); submit(); }}
      ref={formRef}
    >
      <input name="slot" type="hidden" value={slotId} />

      <label className="relative block">
        <span className="sr-only">問題を検索</span>
        <svg aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" fill="none" height="14" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 16 16" width="14"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" strokeLinecap="round" /></svg>
        <input className="wb-search" defaultValue={selected.keyword} name="candidateQ" placeholder="キーワードで検索" type="search" />
      </label>

      <div className="wb-cells">
        <Cell active={Boolean(selected.university)} label="大学">
          <select aria-label="大学で絞り込む" defaultValue={selected.university} name="candidateUniversity" onChange={changeUniversity}>
            <option value="">すべて</option>
            {universities.map((value) => {
              const item = universityProfiles.find((entry) => entry.university === value);
              return <option key={value} value={value}>{value}{item ? `（${item.problemCount}）` : ""}</option>;
            })}
          </select>
        </Cell>

        <Cell active={Boolean(selected.field)} label="分野">
          <select aria-label="分野で絞り込む" defaultValue={selected.field} name="candidateField" onChange={changeField}>
            <option value="">すべて</option>
            {fields.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </Cell>

        <Cell active={selected.difficultyMode !== "all"} label="難易度">
          <select aria-label="難易度で絞り込む" defaultValue={selected.difficultyMode} name="candidateDifficultyMode" onChange={submit} ref={difficultyRef}>
            <option value="all">すべて</option>
            {profile && <optgroup label={`${profile.university}の基準（標準は${profile.baselineDifficulty}）`}>
              <option value="university-easier">易しめ（{countFor(profile, (value) => value < profile.baselineDifficulty)}）</option>
              <option value="university-standard">大学標準（{countFor(profile, (value) => value === profile.baselineDifficulty)}）</option>
              <option value="university-harder">難しめ（{countFor(profile, (value) => value > profile.baselineDifficulty)}）</option>
            </optgroup>}
            <optgroup label="直接指定">
              {exactDifficulties.map((value) => <option key={value} value={`exact-${value}`}>難易度{value}</option>)}
            </optgroup>
          </select>
        </Cell>

        <Cell active={Boolean(selected.timeBand)} label="想定時間">
          <select aria-label="想定時間で絞り込む" defaultValue={selected.timeBand} name="candidateTimeBand" onChange={submit}>
            <option value="">すべて</option>
            {timeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Cell>

        <Cell active={Boolean(selected.usage)} label="使用履歴">
          <select aria-label="使用履歴で絞り込む" defaultValue={selected.usage} name="candidateUsage" onChange={submit}>
            <option value="">すべて</option>
            <option value="unused">未使用のみ</option>
            <option value="used">使用済みのみ</option>
          </select>
        </Cell>

        <Cell active={false} label="表示順">
          <select aria-label="並び順" defaultValue={selected.sort} name="candidateSort" onChange={submit}>
            <option value="least-used">使用が少ない順</option>
            <option value="time-asc">短時間順</option>
            <option value="difficulty-asc">易しい順</option>
            <option value="difficulty-desc">難しい順</option>
            <option value="recent">更新が新しい順</option>
          </select>
        </Cell>
      </div>

      <details open={detailOpen}>
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-muted hover:text-navy">詳細条件</summary>
        <div className="wb-cells mt-2">
          <Cell active={Boolean(selected.subfield)} label="サブ分野">
            <select aria-label="サブ分野で絞り込む" defaultValue={selected.subfield} disabled={!selected.field} name="candidateSubfield" onChange={submit} ref={subfieldRef}>
              <option value="">{selected.field ? "すべて" : "先に分野を選ぶ"}</option>
              {subfields.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </Cell>
          <Cell active={Boolean(selected.verification)} label="検証状態">
            <select aria-label="検証状態で絞り込む" defaultValue={selected.verification} name="candidateVerification" onChange={submit}>
              <option value="">すべて</option>
              {verificationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Cell>
        </div>
      </details>

      <noscript><button className="btn-secondary" type="submit">条件を反映</button></noscript>
    </form>
  );
}
