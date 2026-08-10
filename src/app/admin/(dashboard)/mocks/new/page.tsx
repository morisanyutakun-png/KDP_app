import Link from "next/link";
import { createMockExamAction } from "@/app/admin/author-actions";
import { AdminPageHeader } from "@/components/admin-ui";
import { getProblemFacets, getSubjects, listMockTemplates } from "@/lib/data/authoring";

export const dynamic = "force-dynamic";

const presets = {
  university: { label: "大学別・4問", durationMinutes: 150, questionCount: 4, paperSize: "B5" },
  common: { label: "共通テスト・4問", durationMinutes: 60, questionCount: 4, paperSize: "A4" },
  extended: { label: "大学別・6問", durationMinutes: 150, questionCount: 6, paperSize: "B5" },
} as const;

export default async function NewMockExamPage({ searchParams }: { searchParams: Promise<{ preset?: string }> }) {
  const query = await searchParams;
  const selectedPreset = query.preset && query.preset in presets ? presets[query.preset as keyof typeof presets] : presets.university;
  const [subjects, templates, facets] = await Promise.all([getSubjects(), listMockTemplates(), getProblemFacets()]);

  return <>
    <AdminPageHeader eyebrow="模試制作" title="新しい模試を作成" description="基本枠を作ったあと、登録済み問題を各大問へ配置します。" action={<Link className="btn-secondary" href="/admin/mocks">模試一覧へ戻る</Link>} />
    <div className="workbench grid max-w-6xl items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <section className="card p-4"><p className="text-xs font-bold text-muted">よく使う初期設定</p><div className="mt-3 flex flex-wrap gap-2">{Object.entries(presets).map(([key, preset]) => <Link className={`btn-secondary ${selectedPreset === preset ? "border-slate-500 bg-surface" : ""}`} href={`/admin/mocks/new?preset=${key}`} key={key}>{preset.label}<span className="ml-2 text-xs text-muted">{preset.durationMinutes}分 / {preset.paperSize}</span></Link>)}</div></section>

        <form action={createMockExamAction} className="card space-y-6 p-5 sm:p-7">
          <section><h2 className="font-bold text-navy">1. 模試の基本情報</h2><div className="mt-4 space-y-4"><label><span className="label">模試名 *</span><input className="input" name="title" required placeholder="名古屋大学 数学予想模試 第1回" /></label><div className="grid gap-4 sm:grid-cols-2"><label><span className="label">科目</span><select className="input" name="subjectId" defaultValue=""><option value="">未設定</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><span className="mt-1 block text-xs text-muted">候補検索の初期条件になります。</span></label><label><span className="label">想定大学・試験</span><input className="input" list="new-mock-university-options" name="targetUniversity" placeholder="名古屋大学 / 大学入学共通テスト" /><span className="mt-1 block text-xs text-muted">候補問題の想定大学と部分一致で絞ります。</span></label></div></div></section>

          <section className="border-t border-line pt-6"><h2 className="font-bold text-navy">2. テンプレートまたは個別設定</h2><label className="mt-4"><span className="label">保存済みテンプレート</span><select className="input" name="templateId" defaultValue=""><option value="">使用せず、下の設定で作成</option>{templates.map(({ template }) => <option key={template.id} value={template.id}>{template.name}（{template.questionCount}問 / {template.durationMinutes}分 / {template.paperSettings.paperSize}）</option>)}</select><span className="mt-1.5 block text-xs text-muted">選んだ場合は、科目・大学・問題数・試験時間・紙面設定にテンプレートを優先します。模試名は上の入力を使用します。</span></label><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label><span className="label">試験時間（分）</span><input className="input" name="durationMinutes" type="number" min="1" max="600" defaultValue={selectedPreset.durationMinutes} /></label><label><span className="label">大問数</span><input className="input" name="questionCount" type="number" min="1" max="20" defaultValue={selectedPreset.questionCount} /></label><label><span className="label">用紙</span><select className="input" name="paperSize" defaultValue={selectedPreset.paperSize}><option value="B5">B5</option><option value="A4">A4</option></select></label><label><span className="label">文字サイズ</span><input className="input" name="fontSize" type="number" min="9" max="14" defaultValue="11" /></label><label><span className="label">余白（mm）</span><input className="input" name="marginMm" type="number" min="8" max="35" defaultValue="16" /></label><label><span className="label">段組</span><select className="input" name="columns" defaultValue="1"><option value="1">1段</option><option value="2">2段</option></select></label></div><div className="mt-4 flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="showPageNumbers" defaultChecked />ページ番号</label><label className="flex items-center gap-2"><input type="checkbox" name="pageBreakPerProblem" />問題ごとに改ページ</label></div></section>

          <button className="btn-primary w-full" type="submit">模試を作成して問題を配置する</button>
        </form>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6">
        <section className="card p-5"><h2 className="font-bold text-navy">作成後の流れ</h2><ol className="mt-4 space-y-4 text-sm"><li className="flex gap-3"><strong className="grid size-7 shrink-0 place-items-center bg-navy text-xs text-white">1</strong><span><b className="block text-navy">候補条件を設定</b><span className="text-xs text-muted">分野・難易度・未使用などを大問ごとに指定</span></span></li><li className="flex gap-3"><strong className="grid size-7 shrink-0 place-items-center bg-navy text-xs text-white">2</strong><span><b className="block text-navy">問題を比較して配置</b><span className="text-xs text-muted">本文を確認し、第1問から順に採用</span></span></li><li className="flex gap-3"><strong className="grid size-7 shrink-0 place-items-center bg-navy text-xs text-white">3</strong><span><b className="block text-navy">構成と紙面を確認</b><span className="text-xs text-muted">時間・難易度・分野構成を見て印刷</span></span></li></ol></section>
        <section className="card p-5"><h2 className="font-bold text-navy">既存模試を基に作る</h2><p className="mt-2 text-sm leading-6 text-muted">原稿から登録済みの模試を開き、「複製して編集」を押すと、問題構成と紙面設定を引き継いだ別の模試を作れます。</p><Link className="btn-secondary mt-4 w-full" href="/admin/mocks">登録済み模試から選ぶ</Link></section>
      </aside>
    </div>
    <datalist id="new-mock-university-options">{facets.universities.map((value) => <option key={value} value={value} />)}</datalist>
  </>;
}
