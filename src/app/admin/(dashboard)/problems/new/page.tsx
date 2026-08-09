import Link from "next/link";
import { createProblemAction } from "@/app/admin/author-actions";
import { AdminPageHeader } from "@/components/admin-ui";
import { ProblemForm } from "@/components/problem-form";
import { getSubjects } from "@/lib/data/authoring";

export const dynamic = "force-dynamic";

export default async function NewProblemPage() {
  const subjects = await getSubjects();
  return <><AdminPageHeader eyebrow="PROBLEM BANK" title="問題を登録" description="原稿はMarkdown＋TeXのまま保存します。" action={<Link className="btn-secondary" href="/admin/problems">一覧へ戻る</Link>} /><div className="workbench"><ProblemForm action={createProblemAction} subjects={subjects} /></div></>;
}
