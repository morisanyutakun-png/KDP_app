export const verificationLabels = {
  DRAFT: "未検証",
  REVIEWING: "検証中",
  VERIFIED: "検証済み",
  NEEDS_REVISION: "要修正",
} as const;

export const mockStatusLabels = {
  DRAFT: "編集中",
  READY: "完成",
  ARCHIVED: "アーカイブ",
} as const;

export function excerpt(value: string, length = 120) {
  const normalized = value.replace(/[#*_`>[\]$\\]/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length)}…` : normalized;
}
