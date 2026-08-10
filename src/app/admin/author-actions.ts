"use server";

import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { parseCandidateFilters, readerFromSearch } from "@/lib/candidate-filters";
import { getMathSubject, getMockCandidates, getMockTemplate, getUniversityDifficultyProfiles } from "@/lib/data/authoring";
import { getDb } from "@/lib/db";
import { changeLogs, defaultPaperSettings, mockExamItems, mockExams, mockTemplates, problems, type PaperSettings } from "@/lib/db/schema";

const optionalText = z.string().trim().transform((value) => value || null);
const problemInput = z.object({
  title: z.string().trim().min(1, "管理用タイトルは必須です。").max(120),
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
    title: text(formData, "title"),
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
  const examId = randomUUID();
  await db.batch([
    db.insert(mockExams).values({ id: examId, title, durationMinutes, questionCount, subjectId, targetUniversity, templateId, paperSettings }),
    db.insert(mockExamItems).values(Array.from({ length: questionCount }, (_, index) => ({ mockExamId: examId, position: index + 1 }))),
  ]);
  revalidatePath("/admin");
  revalidatePath("/admin/mocks");
  redirect(`/admin/mocks/${examId}`);
}

export async function createMathMockExamAction() {
  await requireAdmin();
  const mathSubject = await getMathSubject();
  if (!mathSubject) throw new Error("数学科目が登録されていません。先にDBセットアップを確認してください。");
  const db = getDb();
  const examId = randomUUID();
  const questionCount = 4;
  await db.batch([
    db.insert(mockExams).values({
      id: examId,
      title: "数学予想模試（編集中）",
      durationMinutes: 150,
      questionCount,
      subjectId: mathSubject.id,
      paperSettings: defaultPaperSettings,
    }),
    db.insert(mockExamItems).values(Array.from({ length: questionCount }, (_, index) => ({ mockExamId: examId, position: index + 1 }))),
  ]);
  revalidatePath("/admin");
  revalidatePath("/admin/mocks");
  redirect(`/admin/mocks/${examId}`);
}

export async function updateMockSettingsAction(id: string, formData: FormData) {
  await requireAdmin();
  const title = text(formData, "title").trim();
  if (!title) throw new Error("模試名は必須です。");
  const current = await getDb().select().from(mockExams).where(eq(mockExams.id, id)).limit(1);
  if (!current[0]) throw new Error("模試が見つかりません。");
  const requestedStatus = text(formData, "status") === "READY" ? "READY" : "DRAFT";
  if (requestedStatus === "READY") {
    const items = await getDb().select({ problemId: mockExamItems.problemId }).from(mockExamItems).where(eq(mockExamItems.mockExamId, id));
    if (items.some((item) => !item.problemId)) throw new Error("未配置の大問があるため完成にできません。");
  }
  await getDb().update(mockExams).set({
    title,
    subjectId: text(formData, "subjectId") || null,
    targetUniversity: text(formData, "targetUniversity") || null,
    durationMinutes: Math.min(Math.max(Number(text(formData, "durationMinutes")) || 60, 1), 600),
    status: requestedStatus,
    paperSettings: readPaperSettings(formData, current[0].paperSettings),
    updatedAt: new Date(),
  }).where(eq(mockExams.id, id));
  revalidatePath(`/admin/mocks/${id}`);
  revalidatePath(`/admin/print/${id}`);
}

// 採用後も候補の絞り込みを保つための引き継ぎ。想定外のクエリは持ち込まない。
const candidateQueryKeys = [
  "candidateQ",
  "candidateUniversity",
  "candidateField",
  "candidateSubfield",
  "candidateDifficultyMode",
  "candidateTimeBand",
  "candidateUsage",
  "candidateVerification",
  "candidateSort",
] as const;

function candidateQuery(raw: string) {
  const source = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const params = new URLSearchParams();
  for (const key of candidateQueryKeys) {
    const value = source.get(key);
    if (value) params.set(key, value.slice(0, 120));
  }
  return params;
}

export async function assignProblemAction(examId: string, itemId: string, problemId: string, keepQuery = "") {
  await requireAdmin();
  const db = getDb();
  const [[candidate], [duplicate], [currentSlot]] = await Promise.all([
    db.select({ id: problems.id }).from(problems).where(and(eq(problems.id, problemId), eq(problems.isArchived, false))).limit(1),
    db.select({ id: mockExamItems.id }).from(mockExamItems).where(and(
      eq(mockExamItems.mockExamId, examId),
      eq(mockExamItems.problemId, problemId),
      ne(mockExamItems.id, itemId),
    )).limit(1),
    db.select({ id: mockExamItems.id, position: mockExamItems.position }).from(mockExamItems).where(and(eq(mockExamItems.id, itemId), eq(mockExamItems.mockExamId, examId))).limit(1),
  ]);
  if (!candidate) throw new Error("問題が見つからないか、アーカイブされています。");
  if (!currentSlot) throw new Error("大問が見つかりません。");
  if (duplicate) throw new Error("同じ問題は一つの模試に重複配置できません。");
  await db.update(mockExamItems).set({ problemId, updatedAt: new Date() }).where(and(eq(mockExamItems.id, itemId), eq(mockExamItems.mockExamId, examId)));
  await db.update(mockExams).set({ updatedAt: new Date() }).where(eq(mockExams.id, examId));
  const emptySlots = await db.select({ id: mockExamItems.id, position: mockExamItems.position })
    .from(mockExamItems)
    .where(and(eq(mockExamItems.mockExamId, examId), isNull(mockExamItems.problemId)))
    .orderBy(asc(mockExamItems.position));
  const nextSlot = emptySlots.find((slot) => slot.position > currentSlot.position) || emptySlots[0];
  const params = candidateQuery(keepQuery);
  params.set("slot", nextSlot?.id || itemId);
  revalidatePath(`/admin/mocks/${examId}`);
  revalidatePath("/admin/problems");
  redirect(`/admin/mocks/${examId}?${params.toString()}#workspace`);
}

// 候補リストはクライアント側で切り替わるため、採用対象はフォーム値で受け取る。
export async function assignProblemFromFormAction(examId: string, formData: FormData) {
  await assignProblemAction(examId, text(formData, "slotId"), text(formData, "problemId"), text(formData, "keepQuery"));
}

export async function clearSlotAction(examId: string, itemId: string) {
  await requireAdmin();
  await getDb().update(mockExamItems).set({ problemId: null, updatedAt: new Date() }).where(and(eq(mockExamItems.id, itemId), eq(mockExamItems.mockExamId, examId)));
  await getDb().update(mockExams).set({ updatedAt: new Date() }).where(eq(mockExams.id, examId));
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
  await db.batch([
    db.update(mockExamItems).set({ problemId: target.problemId, updatedAt: new Date() }).where(eq(mockExamItems.id, current.id)),
    db.update(mockExamItems).set({ problemId: current.problemId, updatedAt: new Date() }).where(eq(mockExamItems.id, target.id)),
    db.update(mockExams).set({ updatedAt: new Date() }).where(eq(mockExams.id, examId)),
  ]);
  revalidatePath(`/admin/mocks/${examId}`);
}

export async function addMockSlotAction(examId: string) {
  await requireAdmin();
  const db = getDb();
  const [[exam], items] = await Promise.all([
    db.select().from(mockExams).where(eq(mockExams.id, examId)).limit(1),
    db.select({ position: mockExamItems.position }).from(mockExamItems).where(eq(mockExamItems.mockExamId, examId)),
  ]);
  if (!exam) throw new Error("模試が見つかりません。");
  if (items.length >= 20) throw new Error("大問は20問までです。");
  const nextPosition = Math.max(0, ...items.map((item) => item.position)) + 1;
  await db.batch([
    db.insert(mockExamItems).values({ mockExamId: examId, position: nextPosition }),
    db.update(mockExams).set({ questionCount: items.length + 1, updatedAt: new Date() }).where(eq(mockExams.id, examId)),
  ]);
  revalidatePath(`/admin/mocks/${examId}`);
  revalidatePath("/admin/mocks");
}

export async function removeLastEmptyMockSlotAction(examId: string) {
  await requireAdmin();
  const db = getDb();
  const items = await db.select().from(mockExamItems).where(eq(mockExamItems.mockExamId, examId));
  if (items.length <= 1) throw new Error("大問は最低1問必要です。");
  const last = [...items].sort((a, b) => b.position - a.position)[0];
  if (last.problemId) throw new Error("末尾の問題を外してから大問を削除してください。");
  await db.batch([
    db.delete(mockExamItems).where(eq(mockExamItems.id, last.id)),
    db.update(mockExams).set({ questionCount: items.length - 1, updatedAt: new Date() }).where(eq(mockExams.id, examId)),
  ]);
  revalidatePath(`/admin/mocks/${examId}`);
  revalidatePath("/admin/mocks");
}

// 「この条件で空欄を埋める」。候補リストに出ている条件をそのまま使う。
export async function autoAssignEmptySlotsAction(examId: string, formData: FormData) {
  await requireAdmin();
  const db = getDb();
  const [items, [exam]] = await Promise.all([
    db.select().from(mockExamItems).where(eq(mockExamItems.mockExamId, examId)),
    db.select({ subjectId: mockExams.subjectId }).from(mockExams).where(eq(mockExams.id, examId)).limit(1),
  ]);
  const subjectId = exam?.subjectId || (await getMathSubject())?.id;
  const profiles = subjectId ? await getUniversityDifficultyProfiles(subjectId) : [];
  const read = readerFromSearch(text(formData, "keepQuery"));
  const filters = { ...parseCandidateFilters(read, profiles), page: 1, limit: 1 };
  for (const item of items.sort((a, b) => a.position - b.position)) {
    if (item.problemId) continue;
    const result = await getMockCandidates(examId, item.id, filters);
    const candidate = result?.candidates.rows[0]?.problem;
    if (!candidate) continue;
    await db.update(mockExamItems).set({ problemId: candidate.id, updatedAt: new Date() }).where(eq(mockExamItems.id, item.id));
  }
  await db.update(mockExams).set({ updatedAt: new Date() }).where(eq(mockExams.id, examId));
  revalidatePath(`/admin/mocks/${examId}`);
  revalidatePath("/admin/mocks");
  revalidatePath("/admin/problems");
}

export async function duplicateMockExamAction(examId: string) {
  await requireAdmin();
  const db = getDb();
  const [[exam], items] = await Promise.all([
    db.select().from(mockExams).where(eq(mockExams.id, examId)).limit(1),
    db.select().from(mockExamItems).where(eq(mockExamItems.mockExamId, examId)),
  ]);
  if (!exam) throw new Error("模試が見つかりません。");
  const copyId = randomUUID();
  await db.batch([
    db.insert(mockExams).values({
      id: copyId,
      title: `${exam.title}（コピー）`,
      subjectId: exam.subjectId,
      targetUniversity: exam.targetUniversity,
      durationMinutes: exam.durationMinutes,
      questionCount: exam.questionCount,
      status: "DRAFT",
      templateId: exam.templateId,
      paperSettings: exam.paperSettings,
    }),
    db.insert(mockExamItems).values(items.sort((a, b) => a.position - b.position).map((item) => ({
      mockExamId: copyId,
      problemId: item.problemId,
      position: item.position,
      fieldFilter: item.fieldFilter,
      subfieldFilter: item.subfieldFilter,
      difficultyMin: item.difficultyMin,
      difficultyMax: item.difficultyMax,
      unusedOnly: item.unusedOnly,
    }))),
  ]);
  revalidatePath("/admin");
  revalidatePath("/admin/mocks");
  redirect(`/admin/mocks/${copyId}`);
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
