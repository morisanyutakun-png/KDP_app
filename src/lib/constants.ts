export const productionStatusValues = [
  "PLANNING",
  "WRITING",
  "PROOFREADING",
  "PDF_REVIEW",
  "SUBMITTED",
  "IN_REVIEW",
  "PUBLISHED",
  "ON_HOLD",
  "REVISING",
] as const;

export const productionStatusLabels: Record<(typeof productionStatusValues)[number], string> = {
  PLANNING: "企画中",
  WRITING: "作成中",
  PROOFREADING: "校正中",
  PDF_REVIEW: "PDF確認中",
  SUBMITTED: "KDP提出済み",
  IN_REVIEW: "審査中",
  PUBLISHED: "出版済み",
  ON_HOLD: "保留",
  REVISING: "修正中",
};

export const kdpStatusValues = ["DRAFT", "SUBMITTED", "IN_REVIEW", "LIVE", "BLOCKED", "ARCHIVED"] as const;
export const kdpStatusLabels: Record<(typeof kdpStatusValues)[number], string> = {
  DRAFT: "下書き",
  SUBMITTED: "提出済み",
  IN_REVIEW: "審査中",
  LIVE: "販売中",
  BLOCKED: "要対応",
  ARCHIVED: "終了",
};

export const difficultyValues = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"] as const;
export const difficultyLabels: Record<(typeof difficultyValues)[number], string> = {
  BEGINNER: "初級",
  INTERMEDIATE: "中級",
  ADVANCED: "上級",
  ALL_LEVELS: "全レベル",
};

export const formatValues = ["KINDLE", "PAPERBACK", "HARDCOVER", "OTHER"] as const;
export const formatLabels: Record<(typeof formatValues)[number], string> = {
  KINDLE: "Kindle",
  PAPERBACK: "ペーパーバック",
  HARDCOVER: "ハードカバー",
  OTHER: "その他",
};
