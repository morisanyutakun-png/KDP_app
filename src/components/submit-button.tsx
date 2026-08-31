"use client";

import { useFormStatus } from "react-dom";

/** 送信中であることを見せるボタン。押しても無反応に見える取込フォーム向け。 */
export function SubmitButton({ label, pendingLabel, className = "btn-primary" }: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending} type="submit">{pending ? pendingLabel : label}</button>;
}
