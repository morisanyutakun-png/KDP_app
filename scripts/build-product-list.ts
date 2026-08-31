import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { homedir } from "node:os";
import path from "node:path";
import { verifiedAmazonProducts } from "./data/verified-amazon-products";

/**
 * KDPに入稿した本文PDFから「商品名・ページ数・印刷価格」を集計し、
 * 判明しているASIN（verified-amazon-products / KDPレポート）を突き合わせて商品リストを作る。
 *
 *   npx tsx scripts/build-product-list.ts [--source-root ~] [--kdp-report path.csv]
 */

type Book = {
  title: string;
  pages: number;
  trim: "B5";
  printingCost: number;
  asin: string | null;
  price: number | null;
  source: string;
  otherBuilds: number;
};

const option = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

// KDP Amazon.co.jp ペーパーバック・モノクロ印刷。B5(182x257mm)は「大判」に該当する。
// 110ページ以下は固定料金、111ページ以上は固定費+ページ単価。
const printingCost = (pages: number) => (pages <= 110 ? 530 : 206 + 3 * pages);

const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/[：:].*$/, "")
    .replace(/[\s　]/g, "")
    .replace(/第(\d+)巻/g, "vol.$1")
    .replace(/[（）()]/g, "")
    .toLowerCase();

/** 本棚の商品名と入稿PDFの書名で表記が違うものを手当てする。 */
const titleAliases: Record<string, string> = {
  "合格答案をつくる東京科学大学旧東工大数学予想問題集2027": "合格答案をつくる東京科学大数学2027",
  "合格答案をつくる東京科学大学旧東工大数学vol.2": "合格答案をつくる東京科学大数学2027vol.2",
  "合格答案をつくる名大数学2027": "合格答案をつくる名大理系数学2027",
  "合格答案をつくる静大理系数学前期日程2027": "合格答案をつくる静大理系数学2027",
};
const matchKey = (value: string) => {
  const key = normalize(value);
  return titleAliases[key] || key;
};

function collectPdfs(root: string, depth = 4): string[] {
  const found: string[] = [];
  const walk = (dir: string, level: number) => {
    if (level > depth) return;
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      // ゴミ箱やライブラリ配下の複製は正本になり得ない。
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || entry.name === "Library" || entry.name === "Pictures") continue;
        walk(full, level + 1);
      } else if (entry.name.endsWith("_KDP_B5_interior.pdf")) {
        found.push(full);
      }
    }
  };
  walk(root, 0);
  return found;
}

/** PDFの文字列リテラル（8進エスケープ・UTF-16BE）を復号する。 */
function decodePdfString(raw: string) {
  const bytes: number[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== "\\") { bytes.push(raw.charCodeAt(index)); continue; }
    const next = raw[index + 1];
    const octal = raw.slice(index + 1).match(/^[0-7]{1,3}/);
    if (octal) { bytes.push(parseInt(octal[0], 8)); index += octal[0].length; continue; }
    const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };
    bytes.push(escapes[next] ?? next.charCodeAt(0));
    index += 1;
  }
  const buffer = Buffer.from(bytes);
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return buffer.subarray(2).swap16().toString("utf16le").trim();
  return buffer.toString("latin1").trim();
}

/** 本文PDFの /Title を読む。LuaLaTeX出力では圧縮ストリームの中にあるので展開して探す。 */
function pdfTitle(file: string) {
  const buffer = readFileSync(file);
  const raw = buffer.toString("latin1");
  const chunks = [raw];
  for (const match of raw.matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) continue;
    try {
      chunks.push(inflateSync(buffer.subarray(start, end)).toString("latin1"));
    } catch {
      // 画像など展開できないストリームは読み飛ばす。
    }
  }
  for (const chunk of chunks) {
    const at = chunk.indexOf("/Title(");
    if (at < 0) continue;
    let depth = 1;
    let index = at + 7;
    let literal = "";
    while (index < chunk.length && depth > 0) {
      const character = chunk[index];
      if (character === "\\") { literal += chunk.slice(index, index + 2); index += 2; continue; }
      if (character === "(") depth += 1;
      if (character === ")") { depth -= 1; if (!depth) break; }
      literal += character;
      index += 1;
    }
    const title = decodePdfString(literal);
    if (title) return title;
  }
  return path.basename(file).replace(/_KDP_B5_interior\.pdf$/, "");
}

function pdfPages(file: string) {
  const counts = [...readFileSync(file, "latin1").matchAll(/\/Count\s+(\d+)/g)].map((match) => Number(match[1]));
  return counts.length ? Math.max(...counts) : 0;
}

/** KDPのレポート（ASIN列とタイトル列を含むCSV）から ASIN を拾う。列名は日英どちらでも拾えるようにする。 */
function readKdpReport(file: string) {
  const rows = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => line.split(","));
  const header = rows.shift() || [];
  const find = (patterns: RegExp[]) => header.findIndex((cell) => patterns.some((pattern) => pattern.test(cell)));
  const asinAt = find([/asin/i]);
  const priceAt = find([/price/i, /価格/]);
  const titleAt = find([/title/i, /タイトル/, /書名/]);
  const costAt = find([/manufactur/i, /印刷/, /製造/]);
  const interiorAt = find([/interior/i, /入稿/]);
  if (asinAt < 0 || titleAt < 0) throw new Error("KDPレポートに ASIN 列またはタイトル列が見つかりません。");
  return rows
    .map((row) => ({
      asin: (row[asinAt] || "").replace(/"/g, "").trim(),
      title: (row[titleAt] || "").replace(/"/g, "").trim(),
      cost: Number((row[costAt >= 0 ? costAt : priceAt] || "").replace(/[^\d.]/g, "")) || null,
      interior: interiorAt >= 0 ? (row[interiorAt] || "").replace(/"/g, "").trim() : "",
    }))
    .filter((row) => /^B0[A-Z0-9]{8}$/.test(row.asin));
}

const sourceRoot = option("--source-root") || process.env.MANUSCRIPT_SOURCE_ROOT || homedir();
const files = collectPdfs(sourceRoot);
if (!files.length) throw new Error(`${sourceRoot} に本文PDF（*_KDP_B5_interior.pdf）が見つかりません。`);

// 同じ本のコピーが各所に散らばっているので、書名ごとに最新ビルドを正本とする。
const newest = new Map<string, { file: string; mtime: number; count: number }>();
for (const file of files) {
  const title = pdfTitle(file);
  const mtime = statSync(file).mtimeMs;
  const current = newest.get(title);
  if (!current) newest.set(title, { file, mtime, count: 1 });
  else newest.set(title, { file: mtime > current.mtime ? file : current.file, mtime: Math.max(mtime, current.mtime), count: current.count + 1 });
}

type KnownProduct = (typeof verifiedAmazonProducts)[number];
const known = new Map<string, KnownProduct>();
for (const product of verifiedAmazonProducts) {
  known.set(normalize(product.amazonTitle), product);
  known.set(normalize(product.title), product);
}

const reportPath = option("--kdp-report");
const report = reportPath ? readKdpReport(reportPath) : [];
const reportByTitle = new Map<string, (typeof report)[number]>();
for (const row of report) reportByTitle.set(normalize(row.title), row);

const books: Book[] = [...newest.entries()]
  .map(([title, entry]) => {
    const pages = pdfPages(entry.file);
    const key = normalize(title);
    // 誤ったASINを載せないため、正規化後に完全一致したものだけ採用する。
    const match = reportByTitle.get(key) || known.get(key);
    return {
      title,
      pages,
      trim: "B5" as const,
      printingCost: printingCost(pages),
      asin: match?.asin || null,
      price: (match as { price?: number } | undefined)?.price ?? null,
      source: path.relative(sourceRoot, entry.file),
      otherBuilds: entry.count - 1,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title, "ja"));

const localByKey = new Map<string, Book>();
for (const book of books) localByKey.set(matchKey(book.title), book);

const rows = report.length
  ? report.map((entry) => {
    // 同名ビルドが複数ある本は、入稿PDFのパスを明示して取り違えを防ぐ。
    const explicit = entry.interior ? path.join(sourceRoot, entry.interior) : "";
    const pages = explicit ? pdfPages(explicit) : localByKey.get(matchKey(entry.title))?.pages ?? 0;
    const local = explicit ? null : localByKey.get(matchKey(entry.title));
    return {
      title: entry.title,
      asin: entry.asin,
      pages,
      printingCost: pages ? printingCost(pages) : 0,
      trim: "B5" as const,
      price: entry.cost ?? null,
      source: entry.interior || local?.source || "",
      otherBuilds: 0,
    };
  })
  : books;

const csv = [
  "商品名,ASIN,ページ数,印刷価格,判型,販売価格,入稿PDF",
  ...rows.map((book) => [
    `"${book.title.replace(/"/g, '""')}"`,
    book.asin || "",
    book.pages,
    book.printingCost,
    book.trim,
    book.price ?? "",
    `"${book.source}"`,
  ].join(",")),
].join("\n");

const out = option("--out") || path.join(process.cwd(), "scripts/data/product-list.csv");
writeFileSync(out, `${csv}\n`);
console.log(`${rows.length}件を書き出しました: ${out}`);
const missing = rows.filter((row) => !row.pages).map((row) => row.title);
if (missing.length) console.log(`ページ数が突き合わせられなかった商品(${missing.length}件): ${missing.join(" / ")}`);
