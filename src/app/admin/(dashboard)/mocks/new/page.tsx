import Link from "next/link";
import { createMathMockExamAction } from "@/app/admin/author-actions";
import { AdminPageHeader } from "@/components/admin-ui";
import { getMathSubject, getUniversityDifficultyProfiles } from "@/lib/data/authoring";

export const dynamic = "force-dynamic";

export default async function NewMockExamPage() {
  const mathSubject = await getMathSubject();
  const profiles = mathSubject ? await getUniversityDifficultyProfiles(mathSubject.id) : [];
  const ranked = [...profiles].sort((a, b) => b.problemCount - a.problemCount);

  return <>
    <AdminPageHeader
      eyebrow="数学模試"
      title="新しい予想模試"
      description="問題データベースの問題を組み合わせて模試を作ります。"
      action={<Link className="btn-secondary" href="/admin/mocks">模試一覧へ戻る</Link>}
    />
    <div className="workbench max-w-4xl space-y-6">
      <section className="card overflow-hidden">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-bold text-navy">構成を決めて作る</h2>
          <p className="mt-1 text-xs text-muted">作成すると第1問の候補一覧が開きます。大問はあとから増減できます。</p>
        </header>
        <form action={createMathMockExamAction} className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="label text-xs">模試名</span>
            <input className="input" name="title" placeholder="未入力なら大学名から自動で付けます" />
          </label>
          <label>
            <span className="label text-xs">想定大学</span>
            <select className="input" defaultValue="" name="targetUniversity">
              <option value="">指定しない（全大学から探す）</option>
              {ranked.map((profile) => <option key={profile.university} value={profile.university}>{profile.university}（{profile.problemCount}問）</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label>
              <span className="label text-xs">大問数</span>
              <input className="input" defaultValue={4} max="20" min="1" name="questionCount" type="number" />
            </label>
            <label>
              <span className="label text-xs">試験時間（分）</span>
              <input className="input" defaultValue={150} max="600" min="1" name="durationMinutes" type="number" />
            </label>
          </div>
          <div className="sm:col-span-2"><button className="btn-primary w-full" type="submit">作成して第1問を選ぶ</button></div>
        </form>
      </section>

      {ranked.length > 0 && <section className="card overflow-hidden">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-bold text-navy">大学から作る</h2>
          <p className="mt-1 text-xs text-muted">選んだ大学の問題だけに絞った状態で、4問構成の模試を作ります。</p>
        </header>
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map((profile) => <form action={createMathMockExamAction} key={profile.university}>
            <input name="targetUniversity" type="hidden" value={profile.university} />
            <input name="questionCount" type="hidden" value="4" />
            <input name="durationMinutes" type="hidden" value="150" />
            <button className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-left transition hover:border-navy hover:bg-surface" type="submit">
              <span className="block truncate text-[13px] font-bold text-navy">{profile.university}</span>
              <span className="mt-0.5 block text-[11px] text-muted">{profile.problemCount}問 · 平均難易度{profile.averageDifficulty.toFixed(1)}</span>
            </button>
          </form>)}
        </div>
      </section>}

      <p className="text-center text-xs text-muted">既存の模試を基にする場合は、模試一覧から開いて「紙面設定」内の「この模試を複製」を使用してください。</p>
    </div>
  </>;
}
