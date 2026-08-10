import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MathMarkdown } from "@/components/math-markdown";
import { PrintButton } from "@/components/print-button";
import { requireAdmin } from "@/lib/auth";
import { getMockExam } from "@/lib/data/authoring";

export const dynamic = "force-dynamic";
export const metadata = { title: "印刷プレビュー", robots: { index: false, follow: false } };

type Mode = "questions" | "answers" | "combined";

export default async function PrintPreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getMockExam(id);
  if (!data) notFound();
  const mode: Mode = query.mode === "answers" || query.mode === "combined" ? query.mode : "questions";
  const paper = data.exam.paperSettings;
  const width = paper.paperSize === "A4" ? "210mm" : "182mm";
  const minHeight = paper.paperSize === "A4" ? "297mm" : "257mm";
  const pageStyle = { width, minHeight, padding: `${paper.marginMm}mm`, fontSize: `${paper.fontSize}pt`, columnCount: paper.columns } as const;
  const showQuestions = mode === "questions" || mode === "combined";
  const showAnswers = mode === "answers" || mode === "combined";
  return <div className="print-shell min-h-screen bg-slate-200 py-6">
    <style>{`@page { size: ${paper.paperSize}; margin: 0; } .print-page { width:${width}; min-height:${minHeight}; padding:${paper.marginMm}mm; font-size:${paper.fontSize}pt; } ${paper.pageBreakPerProblem ? ".exam-problem{break-before:page}.exam-problem:first-of-type{break-before:auto}" : ""} ${paper.showPageNumbers ? ".page-number{display:block}" : ".page-number{display:none}"}`}</style>
    <div className="no-print sticky top-0 z-20 mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-lg bg-navy p-4 text-white shadow-xl"><div><strong className="block">印刷プレビュー</strong><span className="text-xs text-blue-200">{paper.paperSize} / {paper.fontSize}pt / 余白{paper.marginMm}mm / {paper.columns}段</span></div><div className="flex flex-wrap gap-2 text-navy"><Link className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "questions" ? "bg-teal text-white" : "bg-white"}`} href={`/admin/print/${id}?mode=questions`}>問題</Link><Link className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "answers" ? "bg-teal text-white" : "bg-white"}`} href={`/admin/print/${id}?mode=answers`}>解答</Link><Link className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "combined" ? "bg-teal text-white" : "bg-white"}`} href={`/admin/print/${id}?mode=combined`}>問題＋解答</Link><Link className="rounded-md bg-white px-3 py-2 text-sm font-bold" href={`/admin/mocks/${id}`}>編集へ戻る</Link><PrintButton /></div></div>
    <article className="print-page relative mx-auto bg-white shadow-2xl" style={pageStyle}>
      <header className="mb-10 text-center"><h1 className="text-2xl font-bold tracking-wide">{data.exam.title}</h1><p className="mt-4 font-bold">試験時間：{data.exam.durationMinutes}分</p>{data.exam.targetUniversity && <p className="mt-1 text-sm">{data.exam.targetUniversity}</p>}</header>
      {showQuestions && <section className="exam-booklet">{data.items.map(({ item, problem }) => <section className="exam-problem mb-12 break-inside-avoid" key={`q-${item.id}`}><h2 className="mb-5 border-b-2 border-black pb-2 text-xl font-bold">第{item.position}問</h2>{problem ? <>{problem.imageUrl && <Image unoptimized src={problem.imageUrl} alt="問題図" width={1000} height={700} className="mx-auto mb-5 h-auto max-h-[100mm] w-auto object-contain" />}<MathMarkdown source={problem.statement} /></> : <p className="text-slate-400">問題未配置</p>}</section>)}</section>}
      {showAnswers && <section className={`answer-booklet ${showQuestions ? "break-before-page" : ""}`}><h1 className="mb-10 border-b-4 border-black pb-3 text-2xl font-bold">解答・解説</h1>{data.items.map(({ item, problem }) => <section className="exam-problem mb-12" key={`a-${item.id}`}><h2 className="mb-4 border-b border-black pb-2 text-xl font-bold">第{item.position}問</h2>{problem ? <><h3 className="mt-5 font-bold">解答</h3><MathMarkdown source={problem.answer || "未入力"} /><h3 className="mt-7 font-bold">解説</h3><MathMarkdown source={problem.explanation || "未入力"} /></> : <p className="text-slate-400">問題未配置</p>}</section>)}</section>}
      <span className="page-number fixed bottom-2 left-0 right-0 text-center text-[9pt] after:content-[counter(page)]" />
    </article>
  </div>;
}
