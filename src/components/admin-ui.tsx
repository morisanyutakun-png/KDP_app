import { formatNumber } from "@/lib/utils";

export function AdminPageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-4 border-b border-line bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7"><div><p className="eyebrow">{eyebrow}</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-navy">{title}</h1>{description && <p className="mt-1.5 text-[13px] text-muted">{description}</p>}</div>{action}</div>;
}

export function MetricCard({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return <div className="card p-4 sm:p-5"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-navy">{typeof value === "number" ? formatNumber(value) : value}</p>{note && <p className="mt-1.5 text-xs text-muted">{note}</p>}</div>;
}

export function BarList({ rows, empty = "データはまだありません" }: { rows: Array<{ label: string | null; units: number }>; empty?: string }) {
  const max = Math.max(...rows.map((row) => row.units), 1);
  if (!rows.length) return <div className="grid min-h-40 place-items-center rounded-md bg-surface text-sm text-muted">{empty}</div>;
  return <div className="space-y-4">{rows.map((row, index) => <div key={`${row.label}-${index}`}><div className="mb-1.5 flex justify-between gap-4 text-xs"><span className="truncate font-medium text-ink">{row.label || "未分類"}</span><strong className="shrink-0 font-semibold text-navy">{formatNumber(row.units)} 冊</strong></div><div className="h-1.5 overflow-hidden rounded-sm bg-slate-100"><div className="h-full bg-brand-blue" style={{ width: `${Math.max((row.units / max) * 100, 2)}%` }} /></div></div>)}</div>;
}
