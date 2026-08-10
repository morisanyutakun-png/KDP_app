import { timingSafeEqual } from "node:crypto";
import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { changeLogs, mockExamItems, mockExams, problems, subjects } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const problemSchema = z.object({
  code: z.string().regex(/^IMP-[A-Z0-9-]+-S\d{2}-Q\d{2}$/),
  title: z.string().min(1).max(240),
  field: z.string().min(1).max(120),
  subfield: z.string().max(240).nullable(),
  difficulty: z.number().int().min(1).max(5),
  targetUniversity: z.string().min(1).max(160),
  estimatedMinutes: z.number().int().min(1).max(600),
  statement: z.string().min(1).max(2_000_000),
  answer: z.string().max(1_000_000),
  explanation: z.string().max(2_000_000),
  verificationStatus: z.literal("DRAFT"),
  notes: z.string().max(20_000),
});

const payloadSchema = z.object({
  subjectName: z.literal("数学"),
  subjectSlug: z.literal("mathematics"),
  mock: z.object({
    title: z.string().min(1).max(240),
    targetUniversity: z.string().min(1).max(160),
    durationMinutes: z.number().int().min(1).max(600),
    questionCount: z.number().int().min(1).max(20),
  }),
  problems: z.array(problemSchema).min(1).max(20),
}).superRefine((payload, context) => {
  if (payload.mock.questionCount !== payload.problems.length) {
    context.addIssue({ code: "custom", message: "問題数と模試の大問数が一致しません。" });
  }
  if (new Set(payload.problems.map((problem) => problem.code)).size !== payload.problems.length) {
    context.addIssue({ code: "custom", message: "同一ペイロード内に重複した問題コードがあります。" });
  }
});

function isAuthorized(request: Request) {
  const expected = process.env.MANUSCRIPT_IMPORT_TOKEN;
  const received = request.headers.get("x-manuscript-import-token");
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return json({ error: "Not found" }, 404);
  const db = getDb();
  const [mathSubject] = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.slug, "mathematics")).limit(1);
  if (!mathSubject) return json({ subject: "mathematics", total: 0, imported: 0, mocks: 0, blankAnswers: 0, blankExplanations: 0 });

  const [[problemTotals], [mockTotals]] = await Promise.all([
    db.select({
      total: count(),
      imported: sql<number>`count(*) filter (where ${problems.code} like 'IMP-%')::int`,
      blankAnswers: sql<number>`count(*) filter (where ${problems.code} like 'IMP-%' and ${problems.answer} = '')::int`,
      blankExplanations: sql<number>`count(*) filter (where ${problems.code} like 'IMP-%' and ${problems.explanation} = '')::int`,
    }).from(problems).where(and(eq(problems.subjectId, mathSubject.id), eq(problems.isArchived, false))),
    db.select({ total: count() }).from(mockExams).where(and(eq(mockExams.subjectId, mathSubject.id), ne(mockExams.status, "ARCHIVED"))),
  ]);

  return json({
    subject: "mathematics",
    total: problemTotals?.total || 0,
    imported: Number(problemTotals?.imported || 0),
    mocks: mockTotals?.total || 0,
    blankAnswers: Number(problemTotals?.blankAnswers || 0),
    blankExplanations: Number(problemTotals?.blankExplanations || 0),
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return json({ error: "Not found" }, 404);

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "取込データが不正です。", issues: parsed.error.issues }, 400);

  const payload = parsed.data;
  const db = getDb();
  try {
    const [subject] = await db.insert(subjects).values({ name: payload.subjectName, slug: payload.subjectSlug })
      .onConflictDoUpdate({ target: subjects.slug, set: { name: payload.subjectName, updatedAt: new Date() } })
      .returning({ id: subjects.id });
    if (!subject) throw new Error("数学科目を取得できませんでした。");

    const codes = payload.problems.map((problem) => problem.code);
    const existingProblems = await db.select({ code: problems.code }).from(problems).where(inArray(problems.code, codes));
    const existingCodes = new Set(existingProblems.map((problem) => problem.code));
    const now = new Date();
    const importedProblems = await db.insert(problems).values(payload.problems.map((problem) => ({
      ...problem,
      subjectId: subject.id,
      isArchived: false,
    }))).onConflictDoUpdate({
      target: problems.code,
      set: {
        title: sql`excluded.title`,
        subjectId: subject.id,
        field: sql`excluded.field`,
        subfield: sql`excluded.subfield`,
        difficulty: sql`excluded.difficulty`,
        targetUniversity: sql`excluded.target_university`,
        estimatedMinutes: sql`excluded.estimated_minutes`,
        statement: sql`excluded.statement`,
        answer: sql`excluded.answer`,
        explanation: sql`excluded.explanation`,
        verificationStatus: sql`excluded.verification_status`,
        notes: sql`excluded.notes`,
        isArchived: false,
        updatedAt: now,
      },
    }).returning({ id: problems.id, code: problems.code, title: problems.title });

    const [existingMock] = await db.select({ id: mockExams.id }).from(mockExams)
      .where(and(eq(mockExams.subjectId, subject.id), eq(mockExams.title, payload.mock.title)))
      .limit(1);
    const [mock] = existingMock
      ? await db.update(mockExams).set({
        targetUniversity: payload.mock.targetUniversity,
        durationMinutes: payload.mock.durationMinutes,
        questionCount: payload.mock.questionCount,
        origin: "IMPORT",
        updatedAt: now,
      }).where(eq(mockExams.id, existingMock.id)).returning({ id: mockExams.id })
      : await db.insert(mockExams).values({ ...payload.mock, subjectId: subject.id, origin: "IMPORT" }).returning({ id: mockExams.id });
    if (!mock) throw new Error("模試を作成できませんでした。");

    const problemByCode = new Map(importedProblems.map((problem) => [problem.code, problem]));
    await Promise.all(payload.problems.map((problem, index) => {
      const imported = problemByCode.get(problem.code);
      if (!imported) throw new Error(`問題IDを取得できませんでした: ${problem.code}`);
      return db.insert(mockExamItems).values({ mockExamId: mock.id, problemId: imported.id, position: index + 1 })
        .onConflictDoUpdate({
          target: [mockExamItems.mockExamId, mockExamItems.position],
          set: { problemId: imported.id, updatedAt: now },
        });
    }));

    await db.insert(changeLogs).values(importedProblems.map((problem) => ({
      entityType: "problem",
      entityId: problem.id,
      action: existingCodes.has(problem.code) ? "MANUSCRIPT_IMPORT_UPDATE" : "MANUSCRIPT_IMPORT_CREATE",
      snapshot: { code: problem.code, title: problem.title, mockTitle: payload.mock.title },
    })));

    revalidatePath("/admin");
    revalidatePath("/admin/problems");
    revalidatePath("/admin/mocks");
    return json({
      mockId: mock.id,
      mockCreated: !existingMock,
      problemsCreated: importedProblems.filter((problem) => !existingCodes.has(problem.code)).length,
      problemsUpdated: importedProblems.filter((problem) => existingCodes.has(problem.code)).length,
      problemCount: importedProblems.length,
    });
  } catch (error) {
    console.error("Manuscript import failed", error);
    return json({ error: "原稿データの登録に失敗しました。" }, 500);
  }
}
