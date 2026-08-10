import { FileUploadField } from "@/components/file-upload-field";
import type { Problem } from "@/lib/db/schema";

type SubjectOption = { id: string; name: string };

export function ProblemForm({
  action,
  subjects,
  problem,
}: {
  action: (formData: FormData) => void | Promise<void>;
  subjects: SubjectOption[];
  problem?: Problem;
}) {
  return (
    <form action={action} className="space-y-5">
      <section className="card p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <label><span className="label">科目</span><select className="input" name="subjectId" defaultValue={problem?.subjectId || ""}><option value="">未分類</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
          <label><span className="label">分野 *</span><input className="input" name="field" required defaultValue={problem?.field} placeholder="微積分" /></label>
          <label><span className="label">サブ分野</span><input className="input" name="subfield" defaultValue={problem?.subfield || ""} placeholder="微分法" /></label>
          <label><span className="label">想定大学・レベル</span><input className="input" name="targetUniversity" defaultValue={problem?.targetUniversity || ""} placeholder="名古屋大学" /></label>
          <label><span className="label">難易度 *</span><select className="input" name="difficulty" defaultValue={String(problem?.difficulty || 3)}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>
          <label><span className="label">想定解答時間（分）*</span><input className="input" name="estimatedMinutes" type="number" min="1" max="600" required defaultValue={problem?.estimatedMinutes || 20} /></label>
          <label className="sm:col-span-2"><span className="label">検証状態</span><select className="input" name="verificationStatus" defaultValue={problem?.verificationStatus || "DRAFT"}><option value="DRAFT">未検証</option><option value="REVIEWING">検証中</option><option value="VERIFIED">検証済み</option><option value="NEEDS_REVISION">要修正</option></select></label>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-navy">本文・解答・解説</h2>
        <p className="mt-1 text-xs text-muted">Markdownに加えて、インライン数式は <code>$...$</code>、別行立て数式は <code>$$...$$</code> または <code>\[...\]</code> で入力できます。</p>
        <div className="mt-5 space-y-5">
          <label><span className="label">問題本文 *</span><textarea className="input min-h-72 font-mono leading-7" name="statement" required defaultValue={problem?.statement} placeholder={"関数 $f(x)=x^3-3x$ について考える。\n\n$$f'(x)=3x^2-3$$\n\n(1) ..."} /></label>
          <label><span className="label">解答</span><textarea className="input min-h-48 font-mono leading-7" name="answer" defaultValue={problem?.answer} /></label>
          <label><span className="label">解説</span><textarea className="input min-h-48 font-mono leading-7" name="explanation" defaultValue={problem?.explanation} /></label>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-navy">図・管理メモ</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <FileUploadField name="imageUrl" kind="problem-image" label="問題図・画像（10MBまで）" accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml" initialUrl={problem?.imageUrl} />
          <label><span className="label">管理メモ</span><textarea className="input min-h-28" name="notes" defaultValue={problem?.notes || ""} /></label>
        </div>
      </section>
      <div className="sticky bottom-4 z-10 flex justify-end"><button className="btn-primary min-w-40" type="submit">{problem ? "変更を保存" : "問題を登録"}</button></div>
    </form>
  );
}
