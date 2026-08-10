import "server-only";

import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { mockExamItems, mockExams, mockTemplates, problems, subjects } from "@/lib/db/schema";

export type ProblemSearch = {
  q?: string;
  subjectId?: string;
  field?: string;
  subfield?: string;
  difficultyMin?: number;
  difficultyMax?: number;
  targetUniversity?: string;
  timeMin?: number;
  timeMax?: number;
  usage?: "used" | "unused";
  verification?: "DRAFT" | "REVIEWING" | "VERIFIED" | "NEEDS_REVISION";
  sort?: "recent" | "difficulty-asc" | "difficulty-desc" | "time-asc" | "least-used";
  page?: number;
  limit?: number;
  excludeIds?: string[];
  ignoreExamTarget?: boolean;
};

export type MockExamSearch = {
  q?: string;
  subjectId?: string;
  status?: "DRAFT" | "READY";
  page?: number;
  limit?: number;
};

function problemConditions(filters: ProblemSearch) {
  const conditions = [eq(problems.isArchived, false)];
  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(or(ilike(problems.code, term), ilike(problems.title, term), ilike(problems.statement, term), ilike(problems.field, term), ilike(problems.subfield, term))!);
  }
  if (filters.subjectId) conditions.push(eq(problems.subjectId, filters.subjectId));
  if (filters.field) conditions.push(ilike(problems.field, `%${filters.field}%`));
  if (filters.subfield) conditions.push(ilike(problems.subfield, `%${filters.subfield}%`));
  if (filters.difficultyMin) conditions.push(gte(problems.difficulty, filters.difficultyMin));
  if (filters.difficultyMax) conditions.push(lte(problems.difficulty, filters.difficultyMax));
  if (filters.targetUniversity) conditions.push(ilike(problems.targetUniversity, `%${filters.targetUniversity}%`));
  if (filters.timeMin) conditions.push(gte(problems.estimatedMinutes, filters.timeMin));
  if (filters.timeMax) conditions.push(lte(problems.estimatedMinutes, filters.timeMax));
  if (filters.verification) conditions.push(eq(problems.verificationStatus, filters.verification));
  if (filters.excludeIds?.length) conditions.push(notInArray(problems.id, filters.excludeIds));
  if (filters.usage === "used") conditions.push(sql`exists (select 1 from ${mockExamItems} usage_item where usage_item.problem_id = ${problems.id})`);
  if (filters.usage === "unused") conditions.push(sql`not exists (select 1 from ${mockExamItems} usage_item where usage_item.problem_id = ${problems.id})`);
  return conditions;
}

export async function getSubjects() {
  return getDb().select().from(subjects).orderBy(asc(subjects.name));
}

export async function getProblemFacets(subjectId?: string) {
  const db = getDb();
  const baseConditions = subjectId
    ? and(eq(problems.isArchived, false), eq(problems.subjectId, subjectId))
    : eq(problems.isArchived, false);
  const [fieldRows, subfieldRows, universityRows] = await Promise.all([
    db.selectDistinct({ value: problems.field }).from(problems).where(baseConditions).orderBy(asc(problems.field)),
    db.selectDistinct({ value: problems.subfield }).from(problems).where(and(baseConditions, isNotNull(problems.subfield))).orderBy(asc(problems.subfield)),
    db.selectDistinct({ value: problems.targetUniversity }).from(problems).where(and(baseConditions, isNotNull(problems.targetUniversity))).orderBy(asc(problems.targetUniversity)),
  ]);
  return {
    fields: fieldRows.map((row) => row.value),
    subfields: subfieldRows.map((row) => row.value).filter((value): value is string => Boolean(value)),
    universities: universityRows.map((row) => row.value).filter((value): value is string => Boolean(value)),
  };
}

export async function searchProblems(filters: ProblemSearch = {}) {
  const db = getDb();
  const limit = Math.min(Math.max(filters.limit || 30, 1), 100);
  const page = Math.max(filters.page || 1, 1);
  const where = and(...problemConditions(filters));
  const usageCount = sql<number>`(select count(*)::int from ${mockExamItems} usage_item where usage_item.problem_id = ${problems.id})`;
  const orderBy = filters.sort === "difficulty-asc"
    ? [asc(problems.difficulty), asc(problems.code)]
    : filters.sort === "difficulty-desc"
      ? [desc(problems.difficulty), asc(problems.code)]
      : filters.sort === "time-asc"
        ? [asc(problems.estimatedMinutes), asc(problems.code)]
        : filters.sort === "least-used"
          ? [asc(usageCount), asc(problems.code)]
          : [desc(problems.updatedAt)];
  const [rows, totals] = await Promise.all([
    db.select({
      problem: problems,
      subjectName: subjects.name,
      usageCount,
    }).from(problems).leftJoin(subjects, eq(problems.subjectId, subjects.id)).where(where).orderBy(...orderBy).limit(limit).offset((page - 1) * limit),
    db.select({ value: count() }).from(problems).where(where),
  ]);
  return { rows, total: totals[0]?.value || 0, page, limit };
}

export async function getProblem(id: string) {
  const db = getDb();
  const [row] = await db.select({ problem: problems, subjectName: subjects.name }).from(problems).leftJoin(subjects, eq(problems.subjectId, subjects.id)).where(eq(problems.id, id)).limit(1);
  if (!row) return null;
  const usages = await db.select({
    examId: mockExams.id,
    examTitle: mockExams.title,
    position: mockExamItems.position,
  }).from(mockExamItems).innerJoin(mockExams, eq(mockExamItems.mockExamId, mockExams.id)).where(eq(mockExamItems.problemId, id)).orderBy(desc(mockExams.updatedAt), asc(mockExamItems.position));
  return { ...row, usages };
}

export async function getAuthoringOverview() {
  const db = getDb();
  const [[problemTotal], [verifiedTotal], [mockTotal], [unusedTotal], recentMocks] = await Promise.all([
    db.select({ value: count() }).from(problems).where(eq(problems.isArchived, false)),
    db.select({ value: count() }).from(problems).where(and(eq(problems.isArchived, false), eq(problems.verificationStatus, "VERIFIED"))),
    db.select({ value: count() }).from(mockExams).where(ne(mockExams.status, "ARCHIVED")),
    db.select({ value: count() }).from(problems).where(and(eq(problems.isArchived, false), sql`not exists (select 1 from ${mockExamItems} usage_item where usage_item.problem_id = ${problems.id})`)),
    db.select({ exam: mockExams, subjectName: subjects.name }).from(mockExams).leftJoin(subjects, eq(mockExams.subjectId, subjects.id)).where(ne(mockExams.status, "ARCHIVED")).orderBy(desc(mockExams.updatedAt)).limit(6),
  ]);
  return { problemTotal: problemTotal.value, verifiedTotal: verifiedTotal.value, mockTotal: mockTotal.value, unusedTotal: unusedTotal.value, recentMocks };
}

export async function listMockExams(filters: MockExamSearch = {}) {
  const db = getDb();
  const limit = Math.min(Math.max(filters.limit || 24, 1), 100);
  const page = Math.max(filters.page || 1, 1);
  const conditions = [ne(mockExams.status, "ARCHIVED")];
  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(or(ilike(mockExams.title, term), ilike(mockExams.targetUniversity, term), ilike(subjects.name, term))!);
  }
  if (filters.subjectId) conditions.push(eq(mockExams.subjectId, filters.subjectId));
  if (filters.status) conditions.push(eq(mockExams.status, filters.status));
  const where = and(...conditions);
  const assigned = sql<number>`(select count(*)::int from ${mockExamItems} assigned_item where assigned_item.mock_exam_id = ${mockExams.id} and assigned_item.problem_id is not null)`;
  const [rows, totals] = await Promise.all([
    db.select({ exam: mockExams, subjectName: subjects.name, assigned }).from(mockExams)
      .leftJoin(subjects, eq(mockExams.subjectId, subjects.id))
      .where(where)
      .orderBy(desc(mockExams.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ value: count() }).from(mockExams)
      .leftJoin(subjects, eq(mockExams.subjectId, subjects.id))
      .where(where),
  ]);
  return { rows, total: totals[0]?.value || 0, page, limit };
}

export async function getMockExam(id: string) {
  const db = getDb();
  const [exam] = await db.select({ exam: mockExams, subjectName: subjects.name }).from(mockExams).leftJoin(subjects, eq(mockExams.subjectId, subjects.id)).where(eq(mockExams.id, id)).limit(1);
  if (!exam) return null;
  const items = await db.select({ item: mockExamItems, problem: problems, subjectName: subjects.name }).from(mockExamItems)
    .leftJoin(problems, eq(mockExamItems.problemId, problems.id))
    .leftJoin(subjects, eq(problems.subjectId, subjects.id))
    .where(eq(mockExamItems.mockExamId, id)).orderBy(asc(mockExamItems.position));
  return { ...exam, items };
}

export type MockExamDetail = NonNullable<Awaited<ReturnType<typeof getMockExam>>>;

export async function getMockCandidates(examId: string, itemId: string, extra: ProblemSearch = {}) {
  const db = getDb();
  const [[slot], [exam], assignedRows] = await Promise.all([
    db.select().from(mockExamItems).where(and(eq(mockExamItems.id, itemId), eq(mockExamItems.mockExamId, examId))).limit(1),
    db.select().from(mockExams).where(eq(mockExams.id, examId)).limit(1),
    db.select({ itemId: mockExamItems.id, problemId: mockExamItems.problemId }).from(mockExamItems)
      .where(and(eq(mockExamItems.mockExamId, examId), isNotNull(mockExamItems.problemId))),
  ]);
  if (!slot || !exam) return null;
  const excludeIds = assignedRows
    .filter((row) => row.itemId !== itemId && row.problemId)
    .map((row) => row.problemId!);
  const filters: ProblemSearch = {
    ...extra,
    subjectId: extra.subjectId || exam.subjectId || undefined,
    field: extra.field || slot.fieldFilter || undefined,
    subfield: extra.subfield || slot.subfieldFilter || undefined,
    difficultyMin: extra.difficultyMin || slot.difficultyMin || undefined,
    difficultyMax: extra.difficultyMax || slot.difficultyMax || undefined,
    targetUniversity: extra.ignoreExamTarget ? undefined : extra.targetUniversity || exam.targetUniversity || undefined,
    usage: extra.usage || (slot.unusedOnly ? "unused" : undefined),
    sort: extra.sort || "least-used",
    excludeIds,
    limit: extra.limit || 24,
  };
  const candidates = await searchProblems(filters);
  return { slot, exam, filters, candidates };
}

export async function listMockTemplates() {
  return getDb().select({ template: mockTemplates, subjectName: subjects.name }).from(mockTemplates).leftJoin(subjects, eq(mockTemplates.subjectId, subjects.id)).orderBy(asc(mockTemplates.name));
}

export async function getMockTemplate(id: string) {
  const [template] = await getDb().select().from(mockTemplates).where(eq(mockTemplates.id, id)).limit(1);
  return template || null;
}

export async function getUsedProblemIds(excludeExamId?: string) {
  const where = excludeExamId ? and(isNotNull(mockExamItems.problemId), ne(mockExamItems.mockExamId, excludeExamId)) : isNotNull(mockExamItems.problemId);
  const rows = await getDb().select({ problemId: mockExamItems.problemId }).from(mockExamItems).where(where);
  return new Set(rows.map((row) => row.problemId).filter(Boolean));
}

export async function getProblemsByIds(ids: string[]) {
  if (!ids.length) return [];
  return getDb().select().from(problems).where(inArray(problems.id, ids));
}
