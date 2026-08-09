"use client";

import { upload } from "@vercel/blob/client";
import { useState } from "react";

type Props = {
  name: string;
  kind: "cover" | "sample" | "problem-image";
  label: string;
  accept: string;
  initialUrl?: string | null;
};

export function FileUploadField({ name, kind, label, accept, initialUrl }: Props) {
  const [url, setUrl] = useState(initialUrl || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage("アップロード中…");
    try {
      const safeName = file.name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "-");
      const folder = kind === "cover" ? "materials/covers" : kind === "sample" ? "materials/samples" : "problems/images";
      const result = await upload(`${folder}/${Date.now()}-${safeName}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/blob-upload",
        clientPayload: JSON.stringify({ kind }),
        multipart: file.size > 5 * 1024 * 1024,
      });
      setUrl(result.url); setMessage("アップロード済み");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "アップロードに失敗しました。");
    } finally { setBusy(false); }
  }

  return <div><label className="label" htmlFor={`${name}-file`}>{label}</label><input type="hidden" name={name} value={url} /><div className="flex flex-col gap-2 sm:flex-row"><input id={`${name}-file`} className="input file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-navy" type="file" accept={accept} disabled={busy} onChange={(event) => void onFile(event.target.files?.[0])} />{url && <a className="btn-secondary shrink-0" href={url} target="_blank" rel="noopener noreferrer">確認 ↗</a>}</div>{message && <p className={`mt-1.5 text-xs ${message.includes("失敗") || message.includes("設定") ? "text-red-600" : "text-teal"}`} aria-live="polite">{message}</p>}</div>;
}
