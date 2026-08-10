import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProblemAction } from "@/app/admin/author-actions";
import { AdminPageHeader } from "@/components/admin-ui";
import { ProblemForm } from "@/components/problem-form";
import { getProblem, getProblemFacets, getSubjects } from "@/lib/data/authoring";

export const dynamic = "force-dynamic";

export default async function EditProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, subjects, facets] = await Promise.all([getProblem(id), getSubjects(), getProblemFacets()]);
  if (!data) notFound();
  return <><AdminPageHeader eyebrow="問題管理" title={`${data.problem.title || data.problem.code} を編集`} description={`${data.problem.code} · 数式プレビューを確認しながら編集できます。`} action={<Link className="btn-secondary" href={`/admin/problems/${id}`}>変更を破棄</Link>} /><div className="workbench"><ProblemForm action={updateProblemAction.bind(null, id)} subjects={subjects} facets={facets} problem={data.problem} /></div></>;
}
