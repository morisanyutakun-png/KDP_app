"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getMockTemplate } from "@/lib/data/authoring";
import { getDb } from "@/lib/db";
import { changeLogs, defaultPaperSettings, mockExamItems, mockExams, mockTemplates, problems, type PaperSettings } from "@/lib/db/schema";

const optionalText = z.string().trim().transform((value) => value || null);
const problemInput = z.object({
  subjectId: optionalText,
  field: z.string().trim().min(1, "分野は必須です。"),
  subfield: optionalText,
  difficulty: z.coerce.number().int().min(1).max(5),
  targetUniversity: optionalText,
  estimatedMinutes: z.coerce.number().int().min(1).max(600),
  statement: z.string().trim().min(1, "問題本文は必須です。"),
  answer: z.string(),
  explanation: z.string(),
  imageUrl: optionalText,
  verificationStatus: z.enum(["DRAFT", "REVIEWING", "VERIFIED", "NEEDS_REVISION"]),
  notes: optionalText,
});

function text(formData: FormData, key: string) {
  return String(formData.get(key) || "");
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readPaperSettings(formData: FormData, fallback = defaultPaperSettings): PaperSettings {
  const paperSize = text(formData, "paperSize") === "A4" ? "A4" : "B5";
  const columns = text(formData, "columns") === "2" ? 2 : 1;
  return {
    paperSize,
    columns,
    fontSize: Math.min(Math.max(Number(text(formData, "fontSize")) || fallback.fontSize, 9), 14),
    marginMm: Math.min(Math.max(Number(text(formData, "marginMm")) || fallback.marginMm, 8), 35),
    showPageNumbers: checkbox(formData, "showPageNumbers"),
    pageBreakPerProblem: checkbox(formData, "pageBreakPerProblem"),
  };
}

function parseProblem(formData: FormData) {
  return problemInput.parse({
    subjectId: text(formData, "subjectId"),
    field: text(formData, "field"),
    subfield: text(formData, "subfield"),
    difficulty: text(formData, "difficulty"),
    targetUniversity: text(formData, "targetUniversity"),
    estimatedMinutes: text(formData, "estimatedMinutes"),
    statement: text(formData, "statement"),
    answer: text(formData, "answer"),
    explanation: text(formData, "explanation"),
    imageUrl: text(formData, "imageUrl"),
    verificationStatus: text(formData, "verificationStatus"),
    notes: text(formData, "notes"),
  });
}

export async function createProblemAction(formData: FormData) {
  await requireAdmin();
  const data = parseProblem(formData);
  const now = new Date();
  const code = `PB-${now.toISOString().slice(0, 7).replace("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const db = getDb();
  const [created] = await db.insert(problems).values({ ...data, code }).returning();
  await db.insert(changeLogs).values({ entityType: "problem", entityId: created.id, action: "CREATE", snapshot: created });
  revalidatePath("/admin");
  revalidatePath("/admin/problems");
  redirect(`/admin/problems/${created.id}`);
}

export async function updateProblemAction(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseProblem(formData);
  const db = getDb();
  const [updated] = await db.update(problems).set({ ...data, updatedAt: new Date() }).where(eq(problems.id, id)).returning();
  if (!updated) throw new Error("問題が見つかりません。");
  await db.insert(changeLogs).values({ entityType: "problem", entityId: id, action: "UPDATE", snapshot: updated });
  revalidatePath("/admin");
  revalidatePath("/admin/problems");
  revalidatePath(`/admin/problems/${id}`);
  redirect(`/admin/problems/${id}`);
}

export async function archiveProblemAction(id: string) {
  await requireAdmin();
  const db = getDb();
  const [updated] = await db.update(problems).set({ isArchived: true, updatedAt: new Date() }).where(eq(problems.id, id)).returning();
  if (updated) await db.insert(changeLogs).values({ entityType: "problem", entityId: id, action: "ARCHIVE", snapshot: updated });
  revalidatePath("/admin");
  revalidatePath("/admin/problems");
  redirect("/admin/problems");
}

export async function createMockExamAction(formData: FormData) {
  await requireAdmin();
  const templateId = text(formData, "templateId") || null;
  const template = templateId ? await getMockTemplate(templateId) : null;
  const title = text(formData, "title").trim();
  if (!title) throw new Error("模試名は必須です。");
  const durationMinutes = template?.durationMinutes || Math.min(Math.max(Number(text(formData, "durationMinutes")) || 60, 1), 600);
  const questionCount = template?.questionCount || Math.min(Math.max(Number(text(formData, "questionCount")) || 4, 1), 20);
  const subjectId = template?.subjectId || text(formData, "subjectId") || null;
  const targetUniversity = template?.targetUniversity || text(formData, "targetUniversity") || null;
  const paperSettings = template?.paperSettings || readPaperSettings(formData);
  const db = getDb();
  const created = await db.transaction(async (tx) => {
    const [exam] = await tx.insert(mockExams).values({ title, durationMinutes, questionCount, subjectId, targetUniversity, templateId, paperSettings }).returning();
    await tx.insert(mockExamItems).values(Array.from({ length: questionCount }, (_, index) => ({ mockExamId: exam.id, position: index + 1 })));
    return exam;
  });
  revalidatePath("/admin");
  revalidatePath("/admin/mocks");
  redirect(`/admin/mocks/${created.id}`);
}

export async function updateMockSettingsAction(id: string, formData: FormData) {
  await requireAdmin();
  const title = text(formData, "title").trim();
  if (!title) throw new Error("模試名は必須です。");
  const current = await getDb().select().from(mockExams).where(eq(mockExams.id, id)).limit(1);
  if (!current[0]) throw new Error("模試が見つかりません。");
  await getDb().update(mockExams).set({
    title,
    targetUniversity: text(formData, "targetUniversity") || null,
    durationMinutes: Math.min(Math.max(Number(text(formData, "durationMinutes")) || 60, 1), 600),
    status: text(formData, "status") === "READY" ? "READY" : "DRAFT",
    paperSettings: readPaperSettings(formData, current[0].paperSettings),
    updatedAt: new Date(),
  }).where(eq(mockExams.id, id));
  revalidatePath(`/admin/mocks/${id}`);
  revalidatePath(`/admin/print/${id}`);
}

export async function updateSlotFiltersAction(examId: string, itemId: string, formData: FormData) {
  await requireAdmin();
  await getDb().update(mockExamItems).set({
    fieldFilter: text(formData, "fieldFilter") || null,
    subfieldFilter: text(formData, "subfieldFilter") || null,
    difficultyMin: Number(text(formData, "difficultyMin")) || null,
    difficultyMax: Number(text(formData, "difficultyMax")) || null,
    unusedOnly: checkbox(formData, "unusedOnly"),
    updatedAt: new Date(),
  }).where(and(eq(mockExamItems.id, itemId), eq(mockExamItems.mockExamId, examId)));
  revalidatePath(`/admin/mocks/${examId}`);
}

export async function assignProblemAction(examId: string, itemId: string, problemId: string) {
  await requireAdmin();
  await getDb().update(mockExamItems).set({ problemId, updatedAt: new Date() }).where(and(eq(mockExamItems.id, itemId), eq(mockExamItems.mockExamId, examId)));
  await getDb().update(mockExams).set({ updatedAt: new Date() }).where(eq(mockExams.id, examId));
  revalidatePath(`/admin/mocks/${examId}`);
  revalidatePath("/admin/problems");
}

export async function clearSlotAction(examId: string, itemId: string) {
  await requireAdmin();
  await getDb().update(mockExamItems).set({ problemId: null, updatedAt: new Date() }).where(and(eq(mockExamItems.id, itemId), eq(mockExamItems.mockExamId, examId)));
  revalidatePath(`/admin/mocks/${examId}`);
  revalidatePath("/admin/problems");
}

export async function moveSlotProblemAction(examId: string, itemId: string, direction: "up" | "down") {
  await requireAdmin();
  const db = getDb();
  const [current] = await db.select().from(mockExamItems).where(and(eq(mockExamItems.id, itemId), eq(mockExamItems.mockExamId, examId))).limit(1);
  if (!current) return;
  const targetPosition = current.position + (direction === "up" ? -1 : 1);
  const [target] = await db.select().from(mockExamItems).where(and(eq(mockExamItems.mockExamId, examId), eq(mockExamItems.position, targetPosition))).limit(1);
  if (!target) return;
  await db.transaction(async (tx) => {
    await tx.update(mockExamItems).set({ problemId: target.problemId, updatedAt: new Date() }).where(eq(mockExamItems.id, current.id));
    await tx.update(mockExamItems).set({ problemId: current.problemId, updatedAt: new Date() }).where(eq(mockExamItems.id, target.id));
  });
  revalidatePath(`/admin/mocks/${examId}`);
}

export async function archiveMockExamAction(id: string) {
  await requireAdmin();
  await getDb().update(mockExams).set({ status: "ARCHIVED", updatedAt: new Date() }).where(eq(mockExams.id, id));
  revalidatePath("/admin");
  revalidatePath("/admin/mocks");
  redirect("/admin/mocks");
}

export async function createTemplateAction(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name").trim();
  if (!name) throw new Error("テンプレート名は必須です。");
  await getDb().insert(mockTemplates).values({
    name,
    description: text(formData, "description") || null,
    subjectId: text(formData, "subjectId") || null,
    targetUniversity: text(formData, "targetUniversity") || null,
    durationMinutes: Math.min(Math.max(Number(text(formData, "durationMinutes")) || 60, 1), 600),
    questionCount: Math.min(Math.max(Number(text(formData, "questionCount")) || 4, 1), 20),
    paperSettings: readPaperSettings(formData),
  });
  revalidatePath("/admin/templates");
}

export async function deleteTemplateAction(id: string) {
  await requireAdmin();
  await getDb().delete(mockTemplates).where(eq(mockTemplates.id, id));
  revalidatePath("/admin/templates");
}
