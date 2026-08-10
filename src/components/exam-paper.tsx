import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { MathMarkdown } from "@/components/math-markdown";
import type { MockExamDetail } from "@/lib/data/authoring";

export type ExamPaperMode = "questions" | "answers" | "combined";

export function getPaperDimensions(paperSize: "A4" | "B5") {
  return paperSize === "A4"
    ? { width: "210mm", minHeight: "297mm" }
    : { width: "182mm", minHeight: "257mm" };
}

export function ExamPaper({
  data,
  mode = "questions",
  editBasePath,
  activeItemId,
  className = "",
}: {
  data: MockExamDetail;
  mode?: ExamPaperMode;
  editBasePath?: string;
  activeItemId?: string;
  className?: string;
}) {
  const paper = data.exam.paperSettings;
  const dimensions = getPaperDimensions(paper.paperSize);
  const pageStyle: CSSProperties = {
    width: dimensions.width,
    minHeight: dimensions.minHeight,
    padding: `${paper.marginMm}mm`,
    fontSize: `${paper.fontSize}pt`,
  };
  const bookletStyle: CSSProperties = { columnCount: paper.columns };
  const showQuestions = mode === "questions" || mode === "combined";
  const showAnswers = mode === "answers" || mode === "combined";

  return <article className={`exam-paper relative bg-white ${className}`} style={pageStyle}>
    <header className="mb-10 text-center">
      <h1 className="text-2xl font-bold tracking-wide">{data.exam.title}</h1>
      <p className="mt-4 font-bold">試験時間：{data.exam.durationMinutes}分</p>
      {data.exam.targetUniversity && <p className="mt-1 text-sm">{data.exam.targetUniversity}</p>}
    </header>

    {showQuestions && <section className="exam-booklet" style={bookletStyle}>
      {data.items.map(({ item, problem }) => <section
        className={`exam-problem relative mb-12 break-inside-avoid ${activeItemId === item.id ? "exam-problem-active" : ""}`}
        id={`preview-slot-${item.id}`}
        key={`q-${item.id}`}
      >
        <h2 className="mb-5 border-b-2 border-black pb-2 text-xl font-bold">第{item.position}問</h2>
        {editBasePath && <Link className="paper-edit-control no-print" href={`${editBasePath}?slot=${item.id}#workspace`}>{problem ? "差し替え" : "問題を選ぶ"}</Link>}
        {problem ? <>
          {problem.imageUrl && <Image unoptimized src={problem.imageUrl} alt="問題図" width={1000} height={700} className="mx-auto mb-5 h-auto max-h-[100mm] w-auto object-contain" />}
          <MathMarkdown source={problem.statement} />
        </> : <div className="border border-dashed border-slate-300 px-4 py-10 text-center text-slate-400">問題未配置</div>}
      </section>)}
    </section>}

    {showAnswers && <section className={`answer-booklet ${showQuestions ? "break-before-page" : ""}`} style={bookletStyle}>
      <h1 className="mb-10 border-b-4 border-black pb-3 text-2xl font-bold">解答・解説</h1>
      {data.items.map(({ item, problem }) => <section className="exam-problem mb-12" key={`a-${item.id}`}>
        <h2 className="mb-4 border-b border-black pb-2 text-xl font-bold">第{item.position}問</h2>
        {problem ? <><h3 className="mt-5 font-bold">解答</h3><MathMarkdown source={problem.answer || "未入力"} /><h3 className="mt-7 font-bold">解説</h3><MathMarkdown source={problem.explanation || "未入力"} /></> : <p className="text-slate-400">問題未配置</p>}
      </section>)}
    </section>}
    <span className="page-number fixed right-0 bottom-2 left-0 text-center text-[9pt] after:content-[counter(page)]" />
  </article>;
}
