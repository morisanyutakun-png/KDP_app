"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** 外側クリックとEscで閉じる小さなドロップダウン。 */
export function Popover({ label, children, width = "w-80" }: { label: string; children: ReactNode; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return <details className="relative" onToggle={(event) => setOpen(event.currentTarget.open)} open={open} ref={ref}>
    <summary className="wb-ghost list-none">{label}</summary>
    <div className={`card absolute top-9 right-0 z-30 p-3 shadow-lg ${width}`}>{children}</div>
  </details>;
}
