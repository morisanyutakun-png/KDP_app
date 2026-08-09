export function slugify(value: string) {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_/]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || crypto.randomUUID().slice(0, 8);
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "未設定";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat("ja-JP").format(Number(value || 0));
}

export function formatPrice(amount: number | null | undefined, currency = "JPY") {
  if (amount === null || amount === undefined) return null;
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function safeRedirectPath(path: string | null | undefined, fallback = "/admin") {
  return path?.startsWith("/") && !path.startsWith("//") ? path : fallback;
}
