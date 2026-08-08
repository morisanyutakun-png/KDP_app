import Link from "next/link";

export function SectionHeading({ eyebrow, title, description, href }: { eyebrow: string; title: string; description?: string; href?: string }) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div><p className="eyebrow">{eyebrow}</p><h2 className="mt-2 text-2xl font-black tracking-tight text-navy sm:text-3xl">{title}</h2>{description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}</div>
      {href && <Link href={href} className="hidden shrink-0 text-sm font-bold text-brand-blue hover:underline sm:block">一覧を見る →</Link>}
    </div>
  );
}

export function EmptyCatalog({ title = "教材はまだありません" }: { title?: string }) {
  return (
    <div className="card col-span-full grid min-h-52 place-items-center p-8 text-center">
      <div><div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-surface text-2xl">📚</div><h3 className="font-black text-navy">{title}</h3><p className="mt-2 text-sm text-muted">条件を変えて検索するか、教材の公開をお待ちください。</p></div>
    </div>
  );
}

export function TaxonomyGrid({ items, kind }: { items: Array<{ name: string; slug: string; count: number }>; kind: "university" | "subject" | "series" }) {
  const hrefKey = kind;
  if (!items.length) return <EmptyCatalog title="分類はまだ登録されていません" />;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.slice(0, 8).map((item, index) => (
        <Link key={item.slug} href={`/catalog?${hrefKey}=${encodeURIComponent(item.slug)}`} className="group flex min-h-24 items-center gap-3 rounded-2xl border border-line bg-white p-4 transition hover:border-teal hover:shadow-md">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-sm font-black ${index % 3 === 0 ? "bg-blue-50 text-brand-blue" : index % 3 === 1 ? "bg-teal-50 text-teal" : "bg-orange-50 text-brand-orange"}`}>{item.name.slice(0, 1)}</span>
          <span className="min-w-0"><span className="block truncate text-sm font-bold text-navy group-hover:text-teal">{item.name}</span><span className="mt-1 block text-xs text-muted">{item.count} 冊</span></span>
        </Link>
      ))}
    </div>
  );
}
