import Link from "next/link";
import { createMathMockExamAction } from "@/app/admin/author-actions";
import { AdminPageHeader } from "@/components/admin-ui";

export const dynamic = "force-dynamic";

export default function NewMockExamPage() {
  return <>
    <AdminPageHeader
      eyebrow="数学模試"
      title="新しい予想模試"
      description="最初に設定を入力せず、問題選びから始めます。"
      action={<Link className="btn-secondary" href="/admin/mocks">模試一覧へ戻る</Link>}
    />
    <div className="workbench max-w-3xl">
      <section className="card overflow-hidden">
        <div className="border-b border-line p-6 sm:p-8">
          <p className="text-xs font-bold text-muted">数学専用</p>
          <h2 className="mt-2 text-xl font-bold text-navy">空の4問構成を作成します</h2>
          <p className="mt-3 text-sm leading-7 text-muted">作成すると、すぐに第1問の候補一覧が開きます。模試名・大学・試験時間・紙面設定は、問題構成が決まってから必要なものだけ変更できます。</p>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-line border-b border-line bg-surface text-center text-sm">
          <div className="px-3 py-4"><dt className="text-xs text-muted">科目</dt><dd className="mt-1 font-bold text-navy">数学</dd></div>
          <div className="px-3 py-4"><dt className="text-xs text-muted">大問</dt><dd className="mt-1 font-bold text-navy">4問</dd></div>
          <div className="px-3 py-4"><dt className="text-xs text-muted">初期状態</dt><dd className="mt-1 font-bold text-navy">編集中</dd></div>
        </dl>
        <form action={createMathMockExamAction} className="p-6 sm:p-8">
          <button className="btn-primary w-full" type="submit">作成して第1問を選ぶ</button>
        </form>
      </section>
      <p className="mt-4 text-center text-xs text-muted">既存の模試を基にする場合は、模試一覧から開いて「複製」を使用してください。</p>
    </div>
  </>;
}
