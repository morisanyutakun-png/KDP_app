"use client";

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
  href: string;
  body: ReactNode;
};

type MockWorkbenchProps = {
  slot: { id: string; position: number } | null;
  assigned: WorkbenchProblem | null;
  candidates: WorkbenchProblem[];
  rail: ReactNode;
  listHeader: ReactNode;
  filters: ReactNode;
  pager: ReactNode;
  emptyMessage: string;
  keepQuery: string;
  assignAction: (formData: FormData) => Promise<void>;
  clearAction: (() => Promise<void>) | null;
};

const listWidthKey = "mock-workbench:list-width";

function AssignButton({ position, replacing }: { position: number; replacing: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary h-8 min-h-8 px-3.5 text-[13px]" disabled={pending} type="submit">
    {pending ? "反映中…" : <>第{position}問に{replacing ? "差し替え" : "採用"}<kbd className="ml-2 hidden rounded border border-white/30 px-1 text-[10px] font-normal lg:inline">⏎</kbd></>}
  </button>;
}

export function MockWorkbench({
  slot,
  assigned,
  candidates,
  rail,
  listHeader,
  filters,
  pager,
  emptyMessage,
  keepQuery,
  assignAction,
  clearAction,
}: MockWorkbenchProps) {
  // 未配置の大問では先頭候補をすぐ読めるように開く。配置済みなら現在の問題を優先表示する。
  const token = `${slot?.id || ""}:${candidates.map((candidate) => candidate.id).join(",")}`;
  const fallbackId = assigned ? null : candidates[0]?.id || null;
  const [selection, setSelection] = useState({ token, id: fallbackId });
  const [railOpen, setRailOpen] = useState(true);
  const [previewOnly, setPreviewOnly] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const assignFormRef = useRef<HTMLFormElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // 候補が入れ替わったら選択もリセットする（レイアウトの状態は保つ）。
  const focusedId = selection.token === token ? selection.id : fallbackId;
  const focused = candidates.find((candidate) => candidate.id === focusedId) || null;
  const preview = focused || assigned;

  // 幅はCSS変数で持ち、ドラッグ中は再レンダリングせずDOMだけ更新する。
  useEffect(() => {
    const saved = window.localStorage.getItem(listWidthKey);
    if (saved) rootRef.current?.style.setProperty("--wb-list", saved);
  }, []);

  const resize = (width: number) => {
    const root = rootRef.current;
    if (!root) return;
    const max = Math.max(320, root.clientWidth - 420);
    const next = `${Math.round(Math.min(Math.max(width, 300), max))}px`;
    root.style.setProperty("--wb-list", next);
    window.localStorage.setItem(listWidthKey, next);
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const left = listRef.current?.getBoundingClientRect().left ?? 0;
    const onMove = (moveEvent: PointerEvent) => resize(moveEvent.clientX - left);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("wb-dragging");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.classList.add("wb-dragging");
  };

  const focus = (id: string) => {
    setSelection({ token, id });
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

  return <div
    className="wb-root min-h-0 flex-1"
    data-rail={railOpen ? "on" : "off"}
    data-view={previewOnly ? "preview" : "split"}
    ref={rootRef}
  >
    {!previewOnly && railOpen && <aside className="flex min-h-0 flex-col border-b border-line bg-white xl:border-r xl:border-b-0">
      {rail}
    </aside>}

    {!previewOnly && <section className="flex min-h-0 min-w-0 flex-col border-b border-line bg-white xl:border-b-0" ref={listRef}>
      <div className="flex shrink-0 items-center gap-2 px-2.5 pt-2.5">
        <button
          aria-label={railOpen ? "大問構成を隠す" : "大問構成を表示"}
          className="wb-icon shrink-0"
          onClick={() => setRailOpen((value) => !value)}
          title={railOpen ? "大問構成を隠す" : "大問構成を表示"}
          type="button"
        >{railOpen ? "«" : "»"}</button>
        {listHeader}
      </div>
      {filters}
      <div
        className="wb-scroll flex-1 p-1.5"
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
          else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
          else if (event.key === "Enter" && focusedId) { event.preventDefault(); assignFormRef.current?.requestSubmit(); }
        }}
      >
        {candidates.length ? <ul aria-label="候補問題" className="space-y-px">
          {candidates.map((candidate) => {
            const active = candidate.id === focusedId;
            return <li key={candidate.id}>
              <button
                aria-pressed={active}
                className={`w-full rounded-md px-2.5 py-2 text-left transition ${active ? "bg-blue-50" : "hover:bg-surface"}`}
                onClick={() => focus(candidate.id)}
                ref={(node) => { rowRefs.current.set(candidate.id, node); }}
                tabIndex={candidate.id === tabbableId ? 0 : -1}
                type="button"
              >
                <div className="flex items-baseline gap-2">
                  <span className={`min-w-0 flex-1 truncate text-[13px] ${active ? "font-bold text-navy" : "font-semibold text-ink"}`}>{candidate.title}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted">{candidate.minutes}分</span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted">
                  {candidate.field} · 難易度{candidate.difficulty}
                  {candidate.usageCount ? ` · 使用${candidate.usageCount}回` : ""}
                </p>
              </button>
            </li>;
          })}
        </ul> : <div className="p-8 text-center">
          <p className="text-[13px] font-bold text-navy">条件に合う問題がありません</p>
          <p className="mt-1.5 text-[12px] leading-5 text-muted">{emptyMessage}</p>
        </div>}
      </div>
      {pager}
    </section>}

    {!previewOnly && <div
      aria-label="リストとプレビューの幅を調整"
      aria-orientation="vertical"
      className="wb-splitter"
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const width = listRef.current?.getBoundingClientRect().width ?? 400;
        resize(width + (event.key === "ArrowLeft" ? -24 : 24));
      }}
      onPointerDown={startResize}
      role="separator"
      tabIndex={0}
    />}

    <aside className="flex min-h-0 min-w-0 flex-col bg-surface">
      <header className="flex shrink-0 items-center gap-2 border-b border-line bg-white px-3 py-2">
        {slot && <span className="grid size-6 shrink-0 place-items-center rounded-md bg-navy text-[11px] font-bold text-white">{slot.position}</span>}
        <span className="truncate text-[12px] font-bold text-navy">{focused ? "候補プレビュー" : assigned ? "配置中の問題" : "プレビュー"}</span>

        <div className="ml-auto flex items-center gap-1">
          {clearAction && !focused && <form action={clearAction}><button className="wb-ghost" type="submit">外す</button></form>}
          {slot && focused && <form action={assignAction} ref={assignFormRef}>
            <input name="slotId" type="hidden" value={slot.id} />
            <input name="problemId" type="hidden" value={focused.id} />
            <input name="keepQuery" type="hidden" value={keepQuery} />
            <AssignButton position={slot.position} replacing={Boolean(assigned)} />
          </form>}
          <button
            aria-label={previewOnly ? "リストを表示" : "プレビューを広げる"}
            className="wb-icon"
            onClick={() => setPreviewOnly((value) => !value)}
            title={previewOnly ? "リストを表示" : "プレビューを広げる"}
            type="button"
          >{previewOnly ? "⤡" : "⤢"}</button>
        </div>
      </header>

      <div className="wb-scroll flex-1 p-4 sm:p-6" ref={previewRef}>
        {preview ? <article className="wb-sheet">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold text-navy">{preview.title}</h2>
              <p className="mt-1 text-[11px] text-muted">
                難易度{preview.difficulty} · {preview.field} · {preview.minutes}分
                {preview.university ? ` · ${preview.university}` : ""}
                {preview.note ? ` · ${preview.note}` : ""}
                {preview.usageCount ? ` · 他で使用${preview.usageCount}回` : ""}
              </p>
            </div>
            <a className="shrink-0 text-[11px] font-semibold text-muted underline underline-offset-4 hover:text-navy" href={preview.href}>問題を編集</a>
          </div>
          <div className="mt-6 border-t border-line pt-6">{preview.body}</div>
        </article> : <div className="wb-sheet grid min-h-64 place-items-center text-center">
          <div>
            <p className="text-[13px] font-bold text-navy">左のリストから問題を選んでください</p>
            <p className="mt-1.5 text-[12px] leading-5 text-muted">↑↓で候補を移動、Enterで採用できます。</p>
          </div>
        </div>}
      </div>
    </aside>
  </div>;
}
