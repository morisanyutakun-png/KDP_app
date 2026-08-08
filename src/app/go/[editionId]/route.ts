import { findEditionForRedirect } from "@/lib/data/materials";
import { recordAmazonClick } from "@/lib/data/dashboard";

export async function GET(_request: Request, { params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = await params;
  const edition = await findEditionForRedirect(editionId);
  if (!edition?.amazonUrl) return new Response("購入リンクが見つかりません。", { status: 404 });
  let destination: URL;
  try {
    destination = new URL(edition.amazonUrl);
    if (!['http:', 'https:'].includes(destination.protocol)) throw new Error();
  } catch {
    return new Response("購入リンクが不正です。", { status: 400 });
  }
  try { await recordAmazonClick(edition.id); } catch (error) { console.error("Failed to record Amazon click", error); }
  return Response.redirect(destination, 307);
}
