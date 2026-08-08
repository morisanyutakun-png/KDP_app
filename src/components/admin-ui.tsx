import { formatNumber } from "@/lib/utils";

export function AdminPageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="flex flex-col gap-4 border-b border-line bg-white px-5 py-7 sm:flex-row sm:items-end sm:justify-between sm:px-8"><div><p className="eyebrow">{eyebrow}</p><h1 className="mt-1 text-2xl font-black text-navy sm:text-3xl">{title}</h1>{description && <p className="mt-2 text-sm text-muted">{description}</p>}</div>{action}</div>;
}

export function MetricCard({ label, value, note, tone = "navy" }: { label: string; value: number | string; note?: string; tone?: "navy" | "teal" | "blue" | "orange" }) {
  const styles = { navy: "bg-navy", teal: "bg-teal", blue: "bg-brand-blue", orange: "bg-brand-orange" };
  return <div className="card overflow-hidden"><div className={`h-1.5 ${styles[tone]}`} /><div className="p-5"><p className="text-xs font-bold text-muted">{label}</p><p className="mt-2 text-3xl font-black text-navy">{typeof value === "number" ? formatNumber(value) : value}</p>{note && <p className="mt-2 text-xs text-muted">{note}</p>}</div></div>;
}

export function BarList({ rows, empty = "データはまだありません" }: { rows: Array<{ label: string | null; units: number }>; empty?: string }) {
  const max = Math.max(...rows.map((row) => row.units), 1);
  if (!rows.length) return <div className="grid min-h-40 place-items-center rounded-xl bg-surface text-sm text-muted">{empty}</div>;
  return <div className="space-y-4">{rows.map((row, index) => <div key={`${row.label}-${index}`}><div className="mb-1.5 flex justify-between gap-4 text-xs"><span className="truncate font-semibold text-ink">{row.label || "未分類"}</span><strong className="shrink-0 text-navy">{formatNumber(row.units)} 冊</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal" style={{ width: `${Math.max((row.units / max) * 100, 2)}%` }} /></div></div>)}</div>;
}
