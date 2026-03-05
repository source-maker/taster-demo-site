import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { jobs, testCases } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { enqueueJob } from "@/lib/queue";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  const { generateJobId } = await req.json();

  if (!generateJobId) {
    return NextResponse.json({ error: "generateJobId を指定してください" }, { status: 400 });
  }

  // Verify the generate job belongs to this user and is completed
  const [generateJob] = await db()
    .select()
    .from(jobs)
    .where(eq(jobs.id, generateJobId))
    .limit(1);

  if (!generateJob || generateJob.userId !== session.userId) {
    return NextResponse.json({ error: "ジョブが見つかりません" }, { status: 404 });
  }

  if (generateJob.status !== "completed") {
    return NextResponse.json({ error: "テストケース生成が完了していません" }, { status: 400 });
  }

  // Get test cases for this generate job
  const cases = await db()
    .select()
    .from(testCases)
    .where(eq(testCases.jobId, generateJobId));

  if (cases.length === 0) {
    return NextResponse.json({ error: "テストケースが見つかりません" }, { status: 400 });
  }

  // Create run job
  const [job] = await db().insert(jobs).values({
    userId: session.userId,
    command: "run",
    input: { generateJobId, caseIds: cases.map((c) => c.caseId) },
  }).returning();

  await enqueueJob(job.id, {
    command: "run",
    generateJobId,
    cases: cases.map((c) => ({
      caseId: c.caseId,
      name: c.name,
      url: c.url,
      steps: c.steps,
    })),
    userId: session.userId,
  });

  return NextResponse.json({ jobId: job.id });
}
