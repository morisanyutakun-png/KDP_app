import type { Metadata } from "next";
import Link from "next/link";
import { MaterialCard } from "@/components/material-card";
import { EmptyCatalog } from "@/components/public-ui";
import { getTaxonomies, listPublishedMaterials } from "@/lib/data/materials";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "教材を探す",
  description: "大学・科目・シリーズ・キーワードを組み合わせて教材を検索できます。",
};

type Search = Promise<Record<string, string | string[] | undefined>>;

const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

function pageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/catalog?${next.toString()}`;
}

export default async function CatalogPage({ searchParams }: { searchParams: Search }) {
  const raw = await searchParams;
  const filters = {
    q: single(raw.q) || "",
    university: single(raw.university) || "",
    subject: single(raw.subject) || "",
    series: single(raw.series) || "",
    page: Number(single(raw.page) || 1),
  };
  const [result, taxonomies] = await Promise.all([listPublishedMaterials(filters), getTaxonomies()]);
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.university) query.set("university", filters.university);
  if (filters.subject) query.set("subject", filters.subject);
  if (filters.series) query.set("series", filters.series);

  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="container-page py-10 sm:py-14">
          <p className="eyebrow">CATALOG</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-navy sm:text-4xl">教材を探す</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">複数の条件を組み合わせて、授業や学習目的に合う教材を絞り込めます。</p>
        </div>
      </div>
      <div className="container-page py-8 sm:py-12">
        <form className="card grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]" action="/catalog">
          <div><label className="label" htmlFor="q">キーワード</label><input className="input" id="q" name="q" defaultValue={filters.q} placeholder="タイトル・説明から検索" /></div>
          <div><label className="label" htmlFor="university">大学</label><select className="input" id="university" name="university" defaultValue={filters.university}><option value="">すべて</option>{taxonomies.universities.map((item) => <option key={item.id} value={item.slug}>{item.name} ({item.count})</option>)}</select></div>
          <div><label className="label" htmlFor="subject">科目</label><select className="input" id="subject" name="subject" defaultValue={filters.subject}><option value="">すべて</option>{taxonomies.subjects.map((item) => <option key={item.id} value={item.slug}>{item.name} ({item.count})</option>)}</select></div>
          <div><label className="label" htmlFor="series">シリーズ</label><select className="input" id="series" name="series" defaultValue={filters.series}><option value="">すべて</option>{taxonomies.series.map((item) => <option key={item.id} value={item.slug}>{item.name} ({item.count})</option>)}</select></div>
          <div className="flex items-end gap-2"><button type="submit" className="btn-primary w-full lg:w-auto">検索</button>{query.size > 0 && <Link className="btn-secondary px-3" href="/catalog" aria-label="検索条件をクリア">×</Link>}</div>
        </form>

        <div className="mb-5 mt-9 flex items-center justify-between gap-4"><p className="text-sm text-muted"><strong className="text-xl font-black text-navy">{result.total}</strong> 冊の教材</p><p className="text-xs text-muted">{result.page} / {result.pageCount} ページ</p></div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.length ? result.items.map((material) => <MaterialCard key={material.id} material={material} />) : <EmptyCatalog title="条件に合う教材が見つかりませんでした" />}
        </div>
        {result.pageCount > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-2" aria-label="ページネーション">
            {result.page > 1 && <Link className="btn-secondary" href={pageHref(query, result.page - 1)}>← 前へ</Link>}
            <span className="px-4 text-sm font-bold text-navy">{result.page} / {result.pageCount}</span>
            {result.page < result.pageCount && <Link className="btn-secondary" href={pageHref(query, result.page + 1)}>次へ →</Link>}
          </nav>
        )}
      </div>
    </>
  );
}
