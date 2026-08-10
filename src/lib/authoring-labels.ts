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

export const timeBandOptions = [
  { value: "up-to-10", label: "10分以内", min: undefined, max: 10 },
  { value: "11-to-20", label: "11〜20分", min: 11, max: 20 },
  { value: "21-to-30", label: "21〜30分", min: 21, max: 30 },
  { value: "31-to-45", label: "31〜45分", min: 31, max: 45 },
  { value: "46-plus", label: "46分以上", min: 46, max: undefined },
] as const;

export function getTimeBandRange(value: string) {
  return timeBandOptions.find((option) => option.value === value);
}

export function excerpt(value: string, length = 120) {
  const normalized = value.replace(/[#*_`>[\]$\\]/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length)}…` : normalized;
}
