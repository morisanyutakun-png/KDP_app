import type { MetadataRoute } from "next";
import { getPublicSlugs } from "@/lib/data/materials";
import { siteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/catalog`, changeFrequency: "weekly", priority: 0.9 },
  ];
  try {
    const items = await getPublicSlugs();
    return [...staticPages, ...items.map((item) => ({ url: `${base}/materials/${item.slug}`, lastModified: item.updatedAt, changeFrequency: "monthly" as const, priority: 0.8 }))];
  } catch {
    return staticPages;
  }
}
