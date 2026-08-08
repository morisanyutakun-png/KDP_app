import Image from "next/image";
import Link from "next/link";
import { difficultyLabels, formatLabels } from "@/lib/constants";

type CardMaterial = {
  title: string;
  slug: string;
  description: string;
  coverUrl: string | null;
  difficulty: keyof typeof difficultyLabels;
  universityName?: string | null;
  subjectName?: string | null;
  seriesName?: string | null;
  editions?: Array<{ id: string; format: keyof typeof formatLabels }>;
};

export function MaterialCard({ material }: { material: CardMaterial }) {
  return (
    <article className="group card flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(11,29,74,0.12)]">
      <Link href={`/materials/${material.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-100 to-blue-50">
        {material.coverUrl ? (
          <Image src={material.coverUrl} alt={`${material.title}の表紙`} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-contain p-4 transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-navy text-xl font-black text-white">K</div>
              <p className="line-clamp-3 text-sm font-bold leading-relaxed text-navy">{material.title}</p>
            </div>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-navy shadow-sm">{difficultyLabels[material.difficulty]}</span>
      </Link>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-teal">
          {material.universityName && <span>{material.universityName}</span>}
          {material.subjectName && <><span className="text-slate-300">/</span><span>{material.subjectName}</span></>}
        </div>
        <h3 className="line-clamp-2 text-base font-black leading-snug text-navy sm:text-lg"><Link href={`/materials/${material.slug}`}>{material.title}</Link></h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{material.description}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div className="flex flex-wrap gap-1">
            {material.editions?.slice(0, 2).map((edition) => <span key={edition.id} className="rounded-md bg-surface px-2 py-1 text-[10px] font-bold text-muted">{formatLabels[edition.format]}</span>)}
          </div>
          <Link href={`/materials/${material.slug}`} className="shrink-0 text-xs font-bold text-brand-blue group-hover:underline">詳しく見る →</Link>
        </div>
      </div>
    </article>
  );
}
