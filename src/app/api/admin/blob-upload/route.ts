import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAdminSession } from "@/lib/auth";

export const maxDuration = 30;

const rules = {
  cover: { types: ["image/jpeg", "image/png", "image/webp", "image/avif"], max: 10 * 1024 * 1024, prefix: "materials/covers/" },
  sample: { types: ["application/pdf"], max: 50 * 1024 * 1024, prefix: "materials/samples/" },
  csv: { types: ["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"], max: 50 * 1024 * 1024, prefix: "imports/kdp/" },
  "problem-image": { types: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml"], max: 10 * 1024 * 1024, prefix: "problems/images/" },
} as const;

export async function POST(request: Request) {
  if (!(await getAdminSession())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "BLOB_READ_WRITE_TOKEN が設定されていません。" }, { status: 503 });
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let kind: keyof typeof rules;
        try { kind = JSON.parse(clientPayload || "{}").kind; } catch { throw new Error("アップロード種別が不正です。"); }
        const rule = rules[kind];
        if (!rule || !pathname.startsWith(rule.prefix)) throw new Error("許可されていないアップロードです。");
        return { allowedContentTypes: [...rule.types], maximumSizeInBytes: rule.max, addRandomSuffix: true, tokenPayload: JSON.stringify({ kind }) };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "アップロードを開始できませんでした。" }, { status: 400 });
  }
}
