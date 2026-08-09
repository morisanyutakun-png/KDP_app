import { getAdminSession } from "@/lib/auth";
import { getMockExam } from "@/lib/data/authoring";
import { renderMockMarkdown, type ExportMode } from "@/lib/services/mock-export";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const data = await getMockExam(id);
  if (!data) return new Response("Not found", { status: 404 });
  const requested = new URL(request.url).searchParams.get("mode");
  const mode: ExportMode = requested === "questions" || requested === "answers" ? requested : "combined";
  return new Response(renderMockMarkdown(data, mode), { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="mock-${id}-${mode}.md"` } });
}
