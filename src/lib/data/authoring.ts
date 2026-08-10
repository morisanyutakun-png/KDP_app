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
  targetUniversity?: string;
  status?: "DRAFT" | "READY";
  page?: number;
  limit?: number;
};

export type UniversityDifficultyProfile = {
  university: string;
  problemCount: number;
  averageDifficulty: number;
  baselineDifficulty: number;
  difficultyCounts: Array<{ difficulty: number; count: number }>;
};

// 「使用済み」は利用者が組んだ模試だけを数える。取り込んだ出典セットは在庫扱いにする。
const userMockFilter = sql`${mockExams}.origin = 'USER' and ${mockExams}.status <> 'ARCHIVED'`;
const userUsageQuery = sql`(select 1 from ${mockExamItems} inner join ${mockExams} on ${mockExams.id} = ${mockExamItems.mockExamId} where ${mockExamItems.problemId} = ${problems.id} and ${userMockFilter})`;
const userUsageCount = sql<number>`(select count(*)::int from ${mockExamItems} inner join ${mockExams} on ${mockExams.id} = ${mockExamItems.mockExamId} where ${mockExamItems.problemId} = ${problems.id} and ${userMockFilter})`;

function problemConditions(filters: ProblemSearch) {
  const conditions = [eq(problems.isArchived, false)];
  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(or(ilike(problems.code, term), ilike(problems.title, term), ilike(problems.statement, term), ilike(problems.field, term), ilike(problems.subfield, term))!);
  }
  if (filters.subjectId) conditions.push(eq(problems.subjectId, filters.subjectId));
  if (filters.field) conditions.push(eq(problems.field, filters.field));
  if (filters.subfield) conditions.push(eq(problems.subfield, filters.subfield));
  if (filters.difficultyMin !== undefined) conditions.push(gte(problems.difficulty, filters.difficultyMin));
  if (filters.difficultyMax !== undefined) conditions.push(lte(problems.difficulty, filters.difficultyMax));
  if (filters.targetUniversity) conditions.push(eq(problems.targetUniversity, filters.targetUniversity));
  if (filters.timeMin) conditions.push(gte(problems.estimatedMinutes, filters.timeMin));
  if (filters.timeMax) conditions.push(lte(problems.estimatedMinutes, filters.timeMax));
  if (filters.verification) conditions.push(eq(problems.verificationStatus, filters.verification));
  if (filters.excludeIds?.length) conditions.push(notInArray(problems.id, filters.excludeIds));
  if (filters.usage === "used") conditions.push(sql`exists ${userUsageQuery}`);
  if (filters.usage === "unused") conditions.push(sql`not exists ${userUsageQuery}`);
  return conditions;
}

export async function getSubjects() {
  return getDb().select().from(subjects).orderBy(asc(subjects.name));
}

export async function getMathSubject() {
  const db = getDb();
  const [subjectBySlug] = await db.select().from(subjects)
    .where(eq(subjects.slug, "mathematics"))
    .limit(1);
  if (subjectBySlug) return subjectBySlug;

  // 旧DBとの互換用。取込先として使う正式slugがない場合だけ名前で探す。
  const [legacySubject] = await db.select().from(subjects)
    .where(eq(subjects.name, "数学"))
    .orderBy(asc(subjects.createdAt))
    .limit(1);
  return legacySubject || null;
}

export async function getProblemFacets(subjectId?: string, field?: string) {
  const db = getDb();
  const baseConditions = subjectId
    ? and(eq(problems.isArchived, false), eq(problems.subjectId, subjectId))
    : eq(problems.isArchived, false);
  const subfieldConditions = field ? and(baseConditions, eq(problems.field, field)) : baseConditions;
  const [fieldRows, subfieldRows, universityRows] = await Promise.all([
    db.selectDistinct({ value: problems.field }).from(problems).where(baseConditions).orderBy(asc(problems.field)),
    db.selectDistinct({ value: problems.subfield }).from(problems).where(and(subfieldConditions, isNotNull(problems.subfield))).orderBy(asc(problems.subfield)),
    db.selectDistinct({ value: problems.targetUniversity }).from(problems).where(and(baseConditions, isNotNull(problems.targetUniversity))).orderBy(asc(problems.targetUniversity)),
  ]);
  return {
    fields: fieldRows.map((row) => row.value),
    subfields: subfieldRows.map((row) => row.value).filter((value): value is string => Boolean(value)),
    universities: universityRows.map((row) => row.value).filter((value): value is string => Boolean(value)),
  };
}

export async function getUniversityDifficultyProfiles(subjectId: string): Promise<UniversityDifficultyProfile[]> {
  const rows = await getDb()
    .select({
      university: problems.targetUniversity,
      difficulty: problems.difficulty,
      value: count(),
    })
    .from(problems)
    .where(and(
      eq(problems.isArchived, false),
      eq(problems.subjectId, subjectId),
      isNotNull(problems.targetUniversity),
    ))
    .groupBy(problems.targetUniversity, problems.difficulty)
    .orderBy(asc(problems.targetUniversity), asc(problems.difficulty));

  const grouped = new Map<string, Array<{ difficulty: number; count: number }>>();
  for (const row of rows) {
    const university = row.university?.trim();
    if (!university) continue;
    const difficultyCounts = grouped.get(university) || [];
    difficultyCounts.push({ difficulty: row.difficulty, count: Number(row.value) });
    grouped.set(university, difficultyCounts);
  }

  return Array.from(grouped, ([university, difficultyCounts]) => {
    const problemCount = difficultyCounts.reduce((sum, item) => sum + item.count, 0);
    const averageDifficulty = problemCount
      ? difficultyCounts.reduce((sum, item) => sum + item.difficulty * item.count, 0) / problemCount
      : 0;
    return {
      university,
      problemCount,
      averageDifficulty,
      baselineDifficulty: Math.min(5, Math.max(1, Math.round(averageDifficulty))),
      difficultyCounts,
    };
  });
}

export async function searchProblems(filters: ProblemSearch = {}) {
  const db = getDb();
  const limit = Math.min(Math.max(filters.limit || 30, 1), 100);
  const page = Math.max(filters.page || 1, 1);
  const where = and(...problemConditions(filters));
  const usageCount = userUsageCount;
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
  const mathSubject = await getMathSubject();
  if (!mathSubject) {
    return { problemTotal: 0, verifiedTotal: 0, mockTotal: 0, unusedTotal: 0, recentMocks: [] };
  }
  const [[problemTotal], [verifiedTotal], [mockTotal], [unusedTotal], recentMocks] = await Promise.all([
    db.select({ value: count() }).from(problems).where(and(eq(problems.isArchived, false), eq(problems.subjectId, mathSubject.id))),
    db.select({ value: count() }).from(problems).where(and(eq(problems.isArchived, false), eq(problems.subjectId, mathSubject.id), eq(problems.verificationStatus, "VERIFIED"))),
    db.select({ value: count() }).from(mockExams).where(and(ne(mockExams.status, "ARCHIVED"), eq(mockExams.origin, "USER"), eq(mockExams.subjectId, mathSubject.id))),
    db.select({ value: count() }).from(problems).where(and(eq(problems.isArchived, false), eq(problems.subjectId, mathSubject.id), sql`not exists ${userUsageQuery}`)),
    db.select({ exam: mockExams, subjectName: subjects.name }).from(mockExams).leftJoin(subjects, eq(mockExams.subjectId, subjects.id)).where(and(ne(mockExams.status, "ARCHIVED"), eq(mockExams.origin, "USER"), eq(mockExams.subjectId, mathSubject.id))).orderBy(desc(mockExams.updatedAt)).limit(6),
  ]);
  return { problemTotal: problemTotal.value, verifiedTotal: verifiedTotal.value, mockTotal: mockTotal.value, unusedTotal: unusedTotal.value, recentMocks };
}

export async function listMockExams(filters: MockExamSearch = {}) {
  const db = getDb();
  const limit = Math.min(Math.max(filters.limit || 24, 1), 100);
  const page = Math.max(filters.page || 1, 1);
  const conditions = [ne(mockExams.status, "ARCHIVED"), eq(mockExams.origin, "USER")];
  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(or(ilike(mockExams.title, term), ilike(mockExams.targetUniversity, term), ilike(subjects.name, term))!);
  }
  if (filters.subjectId) conditions.push(eq(mockExams.subjectId, filters.subjectId));
  if (filters.targetUniversity) conditions.push(eq(mockExams.targetUniversity, filters.targetUniversity));
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

export async function getMockExamFacets(subjectId?: string) {
  const conditions = [ne(mockExams.status, "ARCHIVED"), eq(mockExams.origin, "USER"), isNotNull(mockExams.targetUniversity)];
  if (subjectId) conditions.push(eq(mockExams.subjectId, subjectId));
  const rows = await getDb().selectDistinct({ value: mockExams.targetUniversity }).from(mockExams)
    .where(and(...conditions))
    .orderBy(asc(mockExams.targetUniversity));
  return { universities: rows.map((row) => row.value).filter((value): value is string => Boolean(value)) };
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
  // 絞り込みは画面に出ている条件だけを使う。隠れた条件で結果が変わらないようにするため。
  const filters: ProblemSearch = {
    ...extra,
    subjectId: extra.subjectId || exam.subjectId || undefined,
    targetUniversity: extra.ignoreExamTarget ? undefined : extra.targetUniversity || exam.targetUniversity || undefined,
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
  const conditions = [isNotNull(mockExamItems.problemId), eq(mockExams.origin, "USER"), ne(mockExams.status, "ARCHIVED")];
  if (excludeExamId) conditions.push(ne(mockExamItems.mockExamId, excludeExamId));
  const rows = await getDb().select({ problemId: mockExamItems.problemId }).from(mockExamItems)
    .innerJoin(mockExams, eq(mockExams.id, mockExamItems.mockExamId))
    .where(and(...conditions));
  return new Set(rows.map((row) => row.problemId).filter(Boolean));
}

export async function getProblemsByIds(ids: string[]) {
  if (!ids.length) return [];
  return getDb().select().from(problems).where(inArray(problems.id, ids));
}
