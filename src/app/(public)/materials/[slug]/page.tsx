import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MaterialCard } from "@/components/material-card";
import { difficultyLabels, formatLabels } from "@/lib/constants";
import { getPublishedMaterial, getRelatedMaterials } from "@/lib/data/materials";
import { formatDate, siteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const material = await getPublishedMaterial(slug);
  if (!material) return { title: "教材が見つかりません" };
  const description = material.description.slice(0, 150);
  return {
    title: material.title,
    description,
    alternates: { canonical: `/materials/${material.slug}` },
    openGraph: {
      type: "book",
      title: material.title,
      description,
      url: `/materials/${material.slug}`,
      images: material.coverUrl ? [{ url: material.coverUrl, alt: `${material.title}の表紙` }] : undefined,
    },
  };
}

export default async function MaterialDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const material = await getPublishedMaterial(slug);
  if (!material) notFound();
  const related = await getRelatedMaterials(material);
  const firstIsbn = material.editions.find((edition) => edition.isbn)?.isbn;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: material.title,
    description: material.description,
    url: `${siteUrl()}/materials/${material.slug}`,
    image: material.coverUrl || undefined,
    isbn: firstIsbn || undefined,
    datePublished: material.publicationDate || undefined,
    educationalLevel: difficultyLabels[material.difficulty],
    about: [material.universityName, material.subjectName].filter(Boolean),
    isPartOf: material.seriesName ? { "@type": "BookSeries", name: material.seriesName } : undefined,
    workExample: material.editions.map((edition) => ({
      "@type": "Book",
      bookFormat: `https://schema.org/${edition.format === "KINDLE" ? "EBook" : "Paperback"}`,
      isbn: edition.isbn || undefined,
      sameAs: edition.amazonUrl || undefined,
      identifier: edition.asin ? { "@type": "PropertyValue", propertyID: "ASIN", value: edition.asin } : undefined,
    })),
  };

  return (
    <>
      <div className="border-b border-line bg-surface"><div className="container-page py-4 text-xs text-muted"><Link href="/" className="hover:text-navy">トップ</Link><span className="mx-2">/</span><Link href="/catalog" className="hover:text-navy">教材一覧</Link><span className="mx-2">/</span><span className="text-navy">{material.title}</span></div></div>
      <article className="container-page py-10 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(280px,380px)_1fr] lg:gap-16">
          <div>
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-slate-100 to-blue-50 shadow-[0_18px_50px_rgba(11,29,74,0.12)]">
              {material.coverUrl ? <Image src={material.coverUrl} alt={`${material.title}の表紙`} fill priority sizes="(max-width: 1024px) 90vw, 380px" className="object-contain p-6" /> : <div className="absolute inset-0 grid place-items-center p-10 text-center"><div><div className="mx-auto mb-5 grid size-20 place-items-center rounded-3xl bg-navy text-3xl font-black text-white">K</div><p className="text-lg font-black leading-relaxed text-navy">{material.title}</p></div></div>}
            </div>
            {material.samplePdfUrl && <a href={material.samplePdfUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-4 w-full">サンプルPDFを見る ↗</a>}
          </div>

          <div>
            <div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-teal-50 px-3 py-1.5 text-teal">{difficultyLabels[material.difficulty]}</span>{material.seriesName && <Link href={`/catalog?series=${material.seriesSlug}`} className="rounded-full bg-blue-50 px-3 py-1.5 text-brand-blue">{material.seriesName}</Link>}</div>
            <h1 className="mt-5 text-3xl font-black leading-tight tracking-tight text-navy sm:text-4xl lg:text-5xl">{material.title}</h1>
            <p className="mt-6 whitespace-pre-wrap text-base leading-8 text-slate-600">{material.description}</p>

            <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line text-sm sm:grid-cols-3">
              {[
                ["大学", material.universityName], ["科目", material.subjectName], ["シリーズ", material.seriesName],
                ["難易度", difficultyLabels[material.difficulty]], ["出版日", formatDate(material.publicationDate)],
              ].map(([label, value]) => <div className="bg-white p-4" key={label}><dt className="text-xs font-bold text-muted">{label}</dt><dd className="mt-1.5 font-bold text-navy">{value || "未設定"}</dd></div>)}
            </dl>

            <section className="mt-8" aria-labelledby="formats"><h2 id="formats" className="text-lg font-black text-navy">販売形式</h2>
              {material.editions.length ? <div className="mt-3 space-y-3">{material.editions.map((edition) => (
                <div key={edition.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-black text-navy">{formatLabels[edition.format]}</p><div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">{edition.asin && <span>ASIN: {edition.asin}</span>}{edition.isbn && <span>ISBN: {edition.isbn}</span>}</div></div>
                  {edition.amazonUrl && <Link href={`/go/${edition.id}`} prefetch={false} className="btn-amazon shrink-0">Amazonで購入 ↗</Link>}
                </div>
              ))}</div> : <p className="mt-3 rounded-xl bg-surface p-4 text-sm text-muted">販売形式は準備中です。</p>}
            </section>
          </div>
        </div>
      </article>

      {related.length > 0 && <section className="bg-surface py-14 sm:py-20"><div className="container-page"><p className="eyebrow">RELATED</p><h2 className="mt-2 text-2xl font-black text-navy sm:text-3xl">関連教材</h2><div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{related.map((item) => <MaterialCard key={item.id} material={item} />)}</div></div></section>}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
