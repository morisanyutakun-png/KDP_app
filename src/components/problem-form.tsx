import { FileUploadField } from "@/components/file-upload-field";
import { ProblemSubmitButton } from "@/components/problem-submit-button";
import { TexEditorField } from "@/components/tex-editor-field";
import type { Problem } from "@/lib/db/schema";

type SubjectOption = { id: string; name: string };
type ProblemFacets = { fields: string[]; subfields: string[]; universities: string[] };

const difficultyOptions = [
  { value: 1, label: "1 — 基礎" },
  { value: 2, label: "2 — 標準" },
  { value: 3, label: "3 — やや難" },
  { value: 4, label: "4 — 難" },
  { value: 5, label: "5 — 最難関" },
];

export function ProblemForm({
  action,
  subjects,
  facets,
  problem,
}: {
  action: (formData: FormData) => void | Promise<void>;
  subjects: SubjectOption[];
  facets: ProblemFacets;
  problem?: Problem;
}) {
  return (
    <form action={action} className="space-y-5">
      <div className="border-l-4 border-brand-blue bg-blue-50 px-4 py-3 text-sm leading-6 text-ink">
        <strong className="font-semibold text-navy">登録の基本:</strong> まず「未検証」で原稿を保存し、右側のプレビューで数式と改行を確認してから検証状態を更新します。問題IDは保存時に自動発行されます。
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4"><h2 className="font-bold text-navy">基本情報</h2><p className="mt-1 text-xs text-muted">検索と候補抽出に使う情報です。既存の表記に揃えると絞り込みやすくなります。</p></div>
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-4">
          <label className="sm:col-span-2 lg:col-span-4"><span className="label">管理用タイトル *</span><input className="input" name="title" required maxLength={120} defaultValue={problem?.title || ""} placeholder="例: 三次関数の極値と接線" /><span className="mt-1.5 block text-xs text-muted">一覧で識別する短い名称です。問題用紙には印刷されません。</span></label>
          {subjects.length === 1
            ? <label><span className="label">科目</span><span className="input block bg-surface font-bold text-navy">{subjects[0].name}</span><input name="subjectId" type="hidden" value={subjects[0].id} /></label>
            : <label><span className="label">科目</span><select className="input" name="subjectId" defaultValue={problem?.subjectId || ""}><option value="">未分類</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>}
          <label><span className="label">分野 *</span><input className="input" name="field" list="problem-field-options" required defaultValue={problem?.field} placeholder="微積分" /></label>
          <label><span className="label">サブ分野</span><input className="input" name="subfield" list="problem-subfield-options" defaultValue={problem?.subfield || ""} placeholder="微分法" /></label>
          <label><span className="label">想定大学・レベル</span><input className="input" name="targetUniversity" list="problem-university-options" defaultValue={problem?.targetUniversity || ""} placeholder="名古屋大学" /></label>
          <label><span className="label">難易度 *</span><select className="input" name="difficulty" defaultValue={String(problem?.difficulty || 3)}>{difficultyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span className="label">想定解答時間（分）*</span><input className="input" name="estimatedMinutes" type="number" min="1" max="600" required defaultValue={problem?.estimatedMinutes || 20} /></label>
          <label className="sm:col-span-2"><span className="label">検証状態</span><select className="input" name="verificationStatus" defaultValue={problem?.verificationStatus || "DRAFT"}><option value="DRAFT">未検証 — 入力途中・初稿</option><option value="REVIEWING">検証中 — 解答や表現を確認中</option><option value="VERIFIED">検証済み — 模試へ採用可能</option><option value="NEEDS_REVISION">要修正 — 問題点あり</option></select></label>
          <datalist id="problem-field-options">{facets.fields.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="problem-subfield-options">{facets.subfields.map((value) => <option key={value} value={value} />)}</datalist>
          <datalist id="problem-university-options">{facets.universities.map((value) => <option key={value} value={value} />)}</datalist>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4"><h2 className="font-bold text-navy">問題原稿</h2><p className="mt-1 text-xs text-muted">左でMarkdown＋TeXを編集し、右で実際の表示を確認できます。</p></div>
        <div className="p-5 sm:p-6">
          <TexEditorField
            name="statement"
            label="問題本文"
            description="小問番号や条件も含め、問題用紙に載せる内容だけを入力します。"
            required
            rows={16}
            defaultValue={problem?.statement || ""}
            placeholder={"関数 $f(x)=x^3-3x$ について考える。\n\n\\[\nf'(x)=3x^2-3\n\\]\n\n(1) 極値を求めよ。"}
          />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4"><h2 className="font-bold text-navy">解答・解説</h2><p className="mt-1 text-xs text-muted">下書きでは空欄でも保存できます。検証済みにする前に入力してください。</p></div>
        <div className="space-y-7 p-5 sm:p-6">
          <TexEditorField name="answer" label="解答" description="答案として必要な式変形と結論を簡潔に入力します。" rows={11} defaultValue={problem?.answer || ""} placeholder={"$f'(x)=0$ より $x=\\pm1$。したがって…"} />
          <div className="border-t border-line pt-7"><TexEditorField name="explanation" label="解説" description="方針、つまずきやすい点、別解など教材としての説明を入力します。" rows={11} defaultValue={problem?.explanation || ""} placeholder="増減表を作ると符号変化を確認しやすい。" /></div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4"><h2 className="font-bold text-navy">図・管理情報</h2><p className="mt-1 text-xs text-muted">図は問題本文の前に表示されます。出典や作問上の注意は管理メモへ残します。</p></div>
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
          <FileUploadField name="imageUrl" kind="problem-image" label="問題図・画像（10MBまで）" accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml" initialUrl={problem?.imageUrl} />
          <label><span className="label">管理メモ</span><textarea className="input min-h-28" name="notes" defaultValue={problem?.notes || ""} placeholder="出典、作問意図、確認事項など。印刷されません。" /></label>
        </div>
      </section>

      <div className="sticky bottom-0 z-10 flex items-center justify-between border border-line bg-white/95 px-4 py-3 backdrop-blur-sm"><p className="hidden text-xs text-muted sm:block">* は必須項目です。保存後に問題詳細で最終表示を確認してください。</p><ProblemSubmitButton editing={Boolean(problem)} /></div>
    </form>
  );
}
