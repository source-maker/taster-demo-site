import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { testResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  const { jobId } = await params;

  const results = await db
    .select()
    .from(testResults)
    .where(eq(testResults.jobId, jobId));

  return NextResponse.json(results);
}
