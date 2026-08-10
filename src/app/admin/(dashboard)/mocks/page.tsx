import Link from "next/link";
import { AdminPageHeader } from "@/components/admin-ui";
import { mockStatusLabels } from "@/lib/authoring-labels";
import { listMockExams } from "@/lib/data/authoring";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MockExamsPage() {
  const rows = await listMockExams();
  return <><AdminPageHeader eyebrow="模試制作" title="模試・問題集" description="問題を大問へ配置し、印刷と書き出しまで一画面で進めます。" action={<Link className="btn-primary" href="/admin/mocks/new">新しい模試</Link>} /><div className="workbench"><div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{rows.map(({ exam, subjectName, assigned }) => <Link href={`/admin/mocks/${exam.id}`} key={exam.id} className="card group p-5 transition hover:border-brand-blue"><div className="flex items-start justify-between gap-4"><span className="border border-line bg-white px-2 py-1 text-xs text-muted">{mockStatusLabels[exam.status]}</span><span className="text-xs text-muted">{formatDate(exam.updatedAt)}</span></div><h2 className="mt-4 text-lg font-bold text-navy group-hover:text-brand-blue">{exam.title}</h2><p className="mt-2 text-sm text-muted">{subjectName || "科目未設定"}{exam.targetUniversity ? ` · ${exam.targetUniversity}` : ""}</p><div className="mt-5 grid grid-cols-3 divide-x divide-line border-t border-line pt-4 text-center text-xs"><div><strong className="block text-base text-navy">{Number(assigned)}/{exam.questionCount}</strong>配置</div><div><strong className="block text-base text-navy">{exam.durationMinutes}</strong>分</div><div><strong className="block text-base text-navy">{exam.paperSettings.paperSize}</strong>用紙</div></div></Link>)}{!rows.length && <div className="card col-span-full grid min-h-52 place-items-center p-8 text-center"><div><h2 className="font-bold text-navy">模試はまだありません</h2><p className="mt-2 text-sm text-muted">テンプレートまたは基本設定から作成できます。</p><Link className="btn-primary mt-5" href="/admin/mocks/new">最初の模試を作る</Link></div></div>}</div></div></>;
}
