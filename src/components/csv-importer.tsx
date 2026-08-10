"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { processCsvImportAction } from "@/app/admin/actions";

export function CsvImporter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) { setMessage("CSVファイルを選択してください。"); setIsError(true); return; }
    setBusy(true); setIsError(false); setMessage("Vercel Blobへアップロード中…");
    try {
      const safeName = file.name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "-");
      const blob = await upload(`imports/kdp/${Date.now()}-${safeName}`, file, { access: "public", handleUploadUrl: "/api/admin/blob-upload", clientPayload: JSON.stringify({ kind: "csv" }), multipart: file.size > 5 * 1024 * 1024 });
      setMessage("CSVを解析してNeonへ保存中…");
      const response = await processCsvImportAction({ blobUrl: blob.url, filename: file.name });
      if (!response.ok) throw new Error(response.error);
      if (response.result.duplicate) setMessage("同じCSVは取込済みです。二重取込は行いませんでした。");
      else setMessage(`完了: ${response.result.importedRows}行取込・${response.result.duplicateRows}行重複・${response.result.unmatchedRows}行未紐付け`);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (error) { setIsError(true); setMessage(error instanceof Error ? error.message : "CSV取込に失敗しました。"); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="card p-5 sm:p-6"><h2 className="text-lg font-bold text-navy">KDP売上レポートを取り込む</h2><p className="mt-2 text-sm leading-relaxed text-muted">元CSVをBlobへ保存し、解析結果をNeonへ登録します。同一ファイル・同一行は自動的に除外されます。</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><input ref={inputRef} className="input file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-bold" type="file" accept=".csv,text/csv" disabled={busy} /><button className="btn-primary shrink-0" disabled={busy} type="submit">{busy ? "処理中…" : "アップロードして取込"}</button></div>{message && <p className={`mt-3 rounded-md p-3 text-sm font-semibold ${isError ? "bg-red-50 text-red-700" : "bg-teal-50 text-teal"}`} aria-live="polite">{message}</p>}</form>;
}
