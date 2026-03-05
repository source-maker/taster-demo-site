import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { jobs, quotas } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { enqueueJob } from "@/lib/queue";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  const { method, url, repoUrl, framework, maxPages, maxDepth } = await req.json();

  if (!method || !["crawl", "repo"].includes(method)) {
    return NextResponse.json({ error: "method は crawl または repo を指定してください" }, { status: 400 });
  }

  if (method === "crawl" && !url) {
    return NextResponse.json({ error: "URL を入力してください" }, { status: 400 });
  }

  // Check daily quota
  const today = new Date().toISOString().split("T")[0];
  const [quota] = await db()
    .select()
    .from(quotas)
    .where(and(eq(quotas.userId, session.userId), eq(quotas.date, today)))
    .limit(1);

  if (quota && (quota.generationsUsed ?? 0) >= 1) {
    return NextResponse.json({ error: "本日の生成回数上限に達しました（1日1回まで）" }, { status: 429 });
  }

  // Create job
  const input = method === "crawl"
    ? { url, maxPages: maxPages || 50, maxDepth: maxDepth || 3 }
    : { repoUrl, framework };

  const [job] = await db().insert(jobs).values({
    userId: session.userId,
    command: "generate",
    method,
    input,
  }).returning();

  // Update quota
  if (quota) {
    await db()
      .update(quotas)
      .set({ generationsUsed: sql`${quotas.generationsUsed} + 1` })
      .where(eq(quotas.id, quota.id));
  } else {
    await db().insert(quotas).values({
      userId: session.userId,
      date: today,
      generationsUsed: 1,
    });
  }

  // Enqueue job for worker
  await enqueueJob(job.id, {
    command: "generate",
    method,
    input,
    userId: session.userId,
  });

  return NextResponse.json({ jobId: job.id });
}
