import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveProblemAction } from "@/app/admin/author-actions";
import { AdminPageHeader } from "@/components/admin-ui";
import { MathMarkdown } from "@/components/math-markdown";
import { verificationLabels } from "@/lib/authoring-labels";
import { getProblem } from "@/lib/data/authoring";

export const dynamic = "force-dynamic";

export default async function ProblemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getProblem(id);
  if (!data) notFound();
  const archive = archiveProblemAction.bind(null, id);
  return <><AdminPageHeader eyebrow="問題詳細" title={data.problem.title || data.problem.code} description={`${data.problem.code} · ${data.subjectName || "未分類"} / ${data.problem.field}${data.problem.subfield ? ` / ${data.problem.subfield}` : ""}`} action={<div className="flex gap-2"><Link className="btn-secondary" href="/admin/problems">一覧</Link><Link className="btn-primary" href={`/admin/problems/${id}/edit`}>編集</Link></div>} /><div className="workbench grid gap-6 xl:grid-cols-[1fr_320px]"><main className="space-y-6"><section className="card p-6 sm:p-8"><div className="mb-5 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-navy px-3 py-1 text-white">難易度 {data.problem.difficulty}</span><span className="rounded-full bg-blue-50 px-3 py-1 text-brand-blue">{data.problem.estimatedMinutes}分</span><span className="rounded-full bg-teal-50 px-3 py-1 text-teal">{verificationLabels[data.problem.verificationStatus]}</span>{data.problem.targetUniversity && <span className="rounded-full bg-slate-100 px-3 py-1 text-muted">{data.problem.targetUniversity}</span>}</div><h2 className="border-b border-line pb-3 text-lg font-bold text-navy">問題</h2>{data.problem.imageUrl && <Image unoptimized src={data.problem.imageUrl} alt="問題図" width={1000} height={700} className="my-6 h-auto max-h-[500px] w-auto rounded-md border border-line object-contain" />}<MathMarkdown source={data.problem.statement} /></section><section className="card p-6 sm:p-8"><h2 className="border-b border-line pb-3 text-lg font-bold text-navy">解答</h2><MathMarkdown source={data.problem.answer || "_未入力_"} /></section><section className="card p-6 sm:p-8"><h2 className="border-b border-line pb-3 text-lg font-bold text-navy">解説</h2><MathMarkdown source={data.problem.explanation || "_未入力_"} /></section></main><aside className="space-y-5"><section className="card p-5"><h2 className="font-bold text-navy">使用履歴</h2>{data.usages.length ? <div className="mt-4 divide-y divide-line">{data.usages.map((usage) => <Link key={`${usage.examId}-${usage.position}`} href={`/admin/mocks/${usage.examId}`} className="block py-3 text-sm hover:text-brand-blue"><strong className="block">{usage.examTitle}</strong><span className="mt-1 block text-xs text-muted">第{usage.position}問</span></Link>)}</div> : <p className="mt-4 rounded-md bg-surface p-4 text-sm text-muted">まだ模試に使用されていません。</p>}</section>{data.problem.notes && <section className="card p-5"><h2 className="font-bold text-navy">管理メモ</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{data.problem.notes}</p></section>}<form action={archive}><button className="w-full rounded-md border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50" type="submit">問題をアーカイブ</button><p className="mt-2 text-xs text-muted">履歴保護のため完全削除はしません。</p></form></aside></div></>;
}
