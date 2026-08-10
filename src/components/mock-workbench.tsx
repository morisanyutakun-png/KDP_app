"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type WorkbenchProblem = {
  id: string;
  title: string;
  code: string;
  field: string;
  subfield: string | null;
  difficulty: number;
  minutes: number;
  /** 候補リストだけが持つ使用回数。配置済みの問題では null。 */
  usageCount: number | null;
  university: string | null;
  note: string | null;
  snippet: string;
  href: string;
  body: ReactNode;
};

type MockWorkbenchProps = {
  slot: { id: string; position: number } | null;
  assigned: WorkbenchProblem | null;
  candidates: WorkbenchProblem[];
  filters: ReactNode;
  pager: ReactNode;
  settings: ReactNode;
  printHref: string;
  emptyMessage: string;
  keepQuery: string;
  assignAction: (formData: FormData) => Promise<void>;
  clearAction: (() => Promise<void>) | null;
};

function DifficultyMeter({ value }: { value: number }) {
  return <span aria-label={`難易度${value}`} className="flex shrink-0 items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((step) => <span className={`h-1 w-2.5 rounded-[1px] ${step <= value ? "bg-navy" : "bg-slate-200"}`} key={step} />)}
  </span>;
}

function AssignButton({ position, replacing }: { position: number; replacing: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary h-9 min-h-9 px-4 text-[13px]" disabled={pending} type="submit">
    {pending ? "反映中…" : <>第{position}問に{replacing ? "差し替え" : "採用"} <kbd className="ml-2 hidden rounded border border-white/30 px-1 text-[10px] font-normal sm:inline">Enter</kbd></>}
  </button>;
}

function ProblemMeta({ problem }: { problem: WorkbenchProblem }) {
  return <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted">
    <span>難易度{problem.difficulty}</span>
    <span>·</span>
    <span>{problem.field}{problem.subfield ? ` / ${problem.subfield}` : ""}</span>
    <span>·</span>
    <span>{problem.minutes}分</span>
    {problem.university && <><span>·</span><span>{problem.university}</span></>}
    {problem.note && <span className="border border-line px-1.5 py-0.5 font-semibold text-navy">{problem.note}</span>}
    {problem.usageCount !== null && <><span>·</span><span className={problem.usageCount ? "" : "font-semibold text-navy"}>{problem.usageCount ? `他で使用${problem.usageCount}回` : "未使用"}</span></>}
  </div>;
}

export function MockWorkbench({
  slot,
  assigned,
  candidates,
  filters,
  pager,
  settings,
  printHref,
  emptyMessage,
  keepQuery,
  assignAction,
  clearAction,
}: MockWorkbenchProps) {
  // 未配置の大問では先頭候補をすぐ読めるように開く。配置済みなら現在の問題を優先表示する。
  // 大問・絞り込み・ページが変わるとページ側の key で作り直されるため、初期値だけで足りる。
  const [focusedId, setFocusedId] = useState<string | null>(assigned ? null : candidates[0]?.id || null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const assignFormRef = useRef<HTMLFormElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDetailsElement>(null);

  // 紙面設定はポップオーバーなので、外側クリックとEscで閉じる。
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [settingsOpen]);

  const focused = candidates.find((candidate) => candidate.id === focusedId) || null;
  const preview = focused || assigned;

  const focus = (id: string) => {
    setFocusedId(id);
    previewRef.current?.scrollTo({ top: 0 });
  };

  const move = (delta: number) => {
    if (!candidates.length) return;
    const current = candidates.findIndex((candidate) => candidate.id === focusedId);
    const next = candidates[Math.min(Math.max(current < 0 ? 0 : current + delta, 0), candidates.length - 1)];
    if (!next) return;
    focus(next.id);
    const row = rowRefs.current.get(next.id);
    row?.focus();
    row?.scrollIntoView({ block: "nearest" });
  };

  // 候補が未選択でも Tab でリストへ入れるように、先頭行だけは常に到達可能にする。
  const tabbableId = focusedId || candidates[0]?.id || null;

  return <div className="grid min-h-0 min-w-0 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
    <section className="flex min-h-0 min-w-0 flex-col border-b border-line bg-white xl:border-r xl:border-b-0">
      {filters}
      <div
        className="wb-scroll flex-1 p-1.5"
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
          else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
          else if (event.key === "Enter" && focusedId) { event.preventDefault(); assignFormRef.current?.requestSubmit(); }
        }}
      >
        {candidates.length ? <ul aria-label="候補問題" className="space-y-0.5">
          {candidates.map((candidate) => {
            const active = candidate.id === focusedId;
            return <li key={candidate.id}>
              <button
                aria-pressed={active}
                className={`w-full rounded-md border-l-2 px-2.5 py-2 text-left transition ${active ? "border-navy bg-blue-50" : "border-transparent hover:bg-surface"}`}
                onClick={() => focus(candidate.id)}
                ref={(node) => { rowRefs.current.set(candidate.id, node); }}
                tabIndex={candidate.id === tabbableId ? 0 : -1}
                type="button"
              >
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-navy">{candidate.title}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted">{candidate.minutes}分</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-muted">{candidate.snippet}</p>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
                  <DifficultyMeter value={candidate.difficulty} />
                  <span className="min-w-0 truncate">{candidate.field}{candidate.subfield ? ` / ${candidate.subfield}` : ""}</span>
                  <span className={`ml-auto shrink-0 ${candidate.usageCount ? "" : "font-semibold text-navy"}`}>{candidate.usageCount ? `使用${candidate.usageCount}` : "未使用"}</span>
                </div>
              </button>
            </li>;
          })}
        </ul> : <div className="p-8 text-center">
          <p className="text-[13px] font-bold text-navy">条件に合う問題がありません</p>
          <p className="mt-1.5 text-[12px] leading-5 text-muted">{emptyMessage}</p>
        </div>}
      </div>
      {pager}
    </section>

    <aside className="flex min-h-0 min-w-0 flex-col bg-surface">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-white px-3 py-2">
        {slot && <span className="grid size-6 shrink-0 place-items-center rounded-md bg-navy text-[11px] font-bold text-white">{slot.position}</span>}
        <span className="text-[12px] font-bold text-navy">{focused ? "候補プレビュー" : assigned ? "配置中の問題" : "プレビュー"}</span>
        {focused && <span className="border border-line bg-surface px-1.5 py-0.5 text-[10px] font-bold text-muted">未採用</span>}

        <div className="ml-auto flex items-center gap-1.5">
          {clearAction && !focused && <form action={clearAction}><button className="wb-ghost" type="submit">外す</button></form>}
          <details
            className="relative"
            onToggle={(event) => setSettingsOpen(event.currentTarget.open)}
            open={settingsOpen}
            ref={settingsRef}
          >
            <summary className="wb-ghost list-none">紙面設定</summary>
            <div className="card absolute top-9 right-0 z-30 w-80 p-3 shadow-lg">{settings}</div>
          </details>
          <Link className="wb-ghost" href={printHref}>最終紙面</Link>
          {slot && focused && <form action={assignAction} ref={assignFormRef}>
            <input name="slotId" type="hidden" value={slot.id} />
            <input name="problemId" type="hidden" value={focused.id} />
            <input name="keepQuery" type="hidden" value={keepQuery} />
            <AssignButton position={slot.position} replacing={Boolean(assigned)} />
          </form>}
        </div>
      </header>

      <div className="wb-scroll flex-1 p-4 sm:p-6" ref={previewRef}>
        {preview ? <article className="wb-sheet">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold text-navy">{preview.title}</h2>
              <p className="mt-1 text-[11px] text-muted">{preview.code}</p>
            </div>
            <Link className="shrink-0 text-[11px] font-semibold text-muted underline underline-offset-4 hover:text-navy" href={preview.href}>問題を編集</Link>
          </div>
          <ProblemMeta problem={preview} />
          <div className="mt-6">{preview.body}</div>
        </article> : <div className="wb-sheet grid min-h-64 place-items-center text-center">
          <div>
            <p className="text-[13px] font-bold text-navy">左のリストから問題を選んでください</p>
            <p className="mt-1.5 text-[12px] leading-5 text-muted">選ぶとここに問題文が表示されます。↑↓で候補を移動、Enterで採用できます。</p>
          </div>
        </div>}
      </div>
    </aside>
  </div>;
}
