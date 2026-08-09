import { z } from "zod";
import { difficultyValues, formatValues, kdpStatusValues, productionStatusValues } from "@/lib/constants";
import { materialInputSchema } from "@/lib/services/material-service";

const value = (formData: FormData, name: string) => String(formData.get(name) || "");

export function materialFromFormData(formData: FormData) {
  return materialInputSchema.safeParse({
    id: value(formData, "id") || undefined,
    title: value(formData, "title"),
    slug: value(formData, "slug"),
    description: value(formData, "description"),
    problemStructure: value(formData, "problemStructure"),
    university: value(formData, "university"),
    subject: value(formData, "subject"),
    series: value(formData, "series"),
    difficulty: value(formData, "difficulty") as (typeof difficultyValues)[number],
    coverUrl: value(formData, "coverUrl"),
    samplePdfUrl: value(formData, "samplePdfUrl"),
    publicationDate: value(formData, "publicationDate"),
    productionStatus: value(formData, "productionStatus") as (typeof productionStatusValues)[number],
    kdpStatus: value(formData, "kdpStatus") as (typeof kdpStatusValues)[number],
    notes: value(formData, "notes"),
    isPublished: formData.get("isPublished") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    editions: formatValues.map((format) => ({
      format,
      asin: value(formData, `edition.${format}.asin`),
      isbn: value(formData, `edition.${format}.isbn`),
      amazonUrl: value(formData, `edition.${format}.amazonUrl`),
      kdpStatus: value(formData, `edition.${format}.kdpStatus`) as (typeof kdpStatusValues)[number],
      isActive: formData.get(`edition.${format}.isActive`) === "on",
    })),
  });
}

export const uuidSchema = z.string().uuid();
