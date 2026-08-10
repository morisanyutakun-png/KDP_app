"use client";

import { useFormStatus } from "react-dom";

export function ProblemSubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary min-w-40" type="submit" disabled={pending}>{pending ? "保存中…" : editing ? "変更を保存" : "問題を登録"}</button>;
}
