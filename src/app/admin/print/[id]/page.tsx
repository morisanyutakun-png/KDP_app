import Link from "next/link";
import { notFound } from "next/navigation";
import { ExamPaper, getPaperDimensions, type ExamPaperMode } from "@/components/exam-paper";
import { PrintButton } from "@/components/print-button";
import { requireAdmin } from "@/lib/auth";
import { getMockExam } from "@/lib/data/authoring";

export const dynamic = "force-dynamic";
export const metadata = { title: "印刷プレビュー", robots: { index: false, follow: false } };

export default async function PrintPreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await getMockExam(id);
  if (!data) notFound();
  const mode: ExamPaperMode = query.mode === "answers" || query.mode === "combined" ? query.mode : "questions";
  const paper = data.exam.paperSettings;
  const { width, minHeight } = getPaperDimensions(paper.paperSize);
  return <div className="print-shell min-h-screen bg-slate-200 py-6">
    <style>{`@page { size: ${paper.paperSize}; margin: 0; } .print-page { width:${width}; min-height:${minHeight}; padding:${paper.marginMm}mm; font-size:${paper.fontSize}pt; } ${paper.pageBreakPerProblem ? ".exam-problem{break-before:page}.exam-problem:first-of-type{break-before:auto}" : ""} ${paper.showPageNumbers ? ".page-number{display:block}" : ".page-number{display:none}"}`}</style>
    <div className="no-print sticky top-0 z-20 mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-lg bg-navy p-4 text-white shadow-xl"><div><strong className="block">印刷プレビュー</strong><span className="text-xs text-blue-200">{paper.paperSize} / {paper.fontSize}pt / 余白{paper.marginMm}mm / {paper.columns}段</span></div><div className="flex flex-wrap gap-2 text-navy"><Link className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "questions" ? "bg-teal text-white" : "bg-white"}`} href={`/admin/print/${id}?mode=questions`}>問題</Link><Link className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "answers" ? "bg-teal text-white" : "bg-white"}`} href={`/admin/print/${id}?mode=answers`}>解答</Link><Link className={`rounded-md px-3 py-2 text-sm font-bold ${mode === "combined" ? "bg-teal text-white" : "bg-white"}`} href={`/admin/print/${id}?mode=combined`}>問題＋解答</Link><Link className="rounded-md bg-white px-3 py-2 text-sm font-bold" href={`/admin/mocks/${id}`}>編集へ戻る</Link><PrintButton /></div></div>
    <ExamPaper className="print-page mx-auto shadow-2xl" data={data} mode={mode} />
  </div>;
}
