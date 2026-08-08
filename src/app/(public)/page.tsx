import Link from "next/link";
import { MaterialCard } from "@/components/material-card";
import { EmptyCatalog, SectionHeading, TaxonomyGrid } from "@/components/public-ui";
import { getHomeData } from "@/lib/data/materials";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getHomeData();
  return (
    <>
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_80%_20%,#0d9488_0,transparent_30%),radial-gradient(circle_at_15%_80%,#1d4ed8_0,transparent_35%)]" />
        <div className="container-page relative py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="mb-4 text-xs font-bold tracking-[0.2em] text-teal-300">大学の学びを、もっと探しやすく。</p>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">あなたの授業に合う教材を<br className="hidden sm:block" />まっすぐ見つける。</h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-blue-100 sm:text-lg">大学・科目・シリーズから整理された教材棚。必要な一冊へ、迷わずたどり着けます。</p>
            <form action="/catalog" className="mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-2xl sm:flex-row">
              <label className="sr-only" htmlFor="home-search">教材を検索</label>
              <input id="home-search" name="q" className="min-h-12 flex-1 rounded-xl px-4 text-sm text-ink outline-none" placeholder="教材名・キーワードで検索" />
              <button className="btn-primary bg-teal hover:bg-teal/90" type="submit">教材を検索</button>
            </form>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-blue-100"><span>✓ ログイン不要</span><span>✓ {data.total}冊を掲載</span><span>✓ Amazonで購入</span></div>
          </div>
        </div>
      </section>

      <section className="container-page py-14 sm:py-20">
        <SectionHeading eyebrow="NEW ARRIVALS" title="新着教材" description="最近公開された教材をチェックできます。" href="/catalog" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {data.newest.length ? data.newest.map((material) => <MaterialCard key={material.id} material={material} />) : <EmptyCatalog />}
        </div>
      </section>

      <section className="bg-surface py-14 sm:py-20">
        <div className="container-page">
          <SectionHeading eyebrow="FEATURED" title="注目教材" description="いま特におすすめしたい教材をまとめました。" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.featured.length ? data.featured.map((material) => <MaterialCard key={material.id} material={material} />) : <EmptyCatalog title="注目教材は準備中です" />}
          </div>
        </div>
      </section>

      <section id="universities" className="container-page scroll-mt-24 py-14 sm:py-20">
        <SectionHeading eyebrow="BY UNIVERSITY" title="大学から探す" description="所属する大学・対象大学から教材を絞り込みます。" />
        <TaxonomyGrid items={data.universities} kind="university" />
      </section>

      <section id="subjects" className="bg-navy py-14 text-white sm:py-20">
        <div className="container-page [&_.eyebrow]:text-teal-300 [&_h2]:text-white [&_p]:text-blue-100"><SectionHeading eyebrow="BY SUBJECT" title="科目から探す" description="履修中の科目や学びたい分野から探せます。" /><div className="[&_p]:text-muted"><TaxonomyGrid items={data.subjects} kind="subject" /></div></div>
      </section>

      <section className="container-page py-14 sm:py-20">
        <SectionHeading eyebrow="BY SERIES" title="シリーズから探す" description="同じ方針で作られた教材を続けて学べます。" />
        <TaxonomyGrid items={data.series} kind="series" />
      </section>

      <section className="bg-surface py-14 sm:py-20">
        <div className="container-page">
          <SectionHeading eyebrow="ALL MATERIALS" title="全教材一覧" description={`公開中の教材 ${data.total} 冊から探せます。`} href="/catalog" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.all.length ? data.all.map((material) => <MaterialCard key={material.id} material={material} />) : <EmptyCatalog />}
          </div>
          {data.total > 0 && <div className="mt-9 text-center"><Link className="btn-primary" href="/catalog">すべての教材を見る</Link></div>}
        </div>
      </section>
    </>
  );
}
