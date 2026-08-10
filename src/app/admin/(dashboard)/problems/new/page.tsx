import Link from "next/link";
import { createProblemAction } from "@/app/admin/author-actions";
import { AdminPageHeader } from "@/components/admin-ui";
import { ProblemForm } from "@/components/problem-form";
import { getMathSubject, getProblemFacets } from "@/lib/data/authoring";

export const dynamic = "force-dynamic";

export default async function NewProblemPage() {
  const mathSubject = await getMathSubject();
  const facets = mathSubject
    ? await getProblemFacets(mathSubject.id)
    : { fields: [], subfields: [], universities: [] };
  return <><AdminPageHeader eyebrow="数学問題管理" title="数学問題を登録" description="分類を設定し、数式を確認しながら問題・解答・解説を入力します。" action={<Link className="btn-secondary" href="/admin/problems">一覧へ戻る</Link>} /><div className="workbench"><ProblemForm action={createProblemAction} subjects={mathSubject ? [mathSubject] : []} facets={facets} /></div></>;
}
