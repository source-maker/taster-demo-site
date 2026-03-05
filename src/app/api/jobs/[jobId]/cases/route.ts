import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { testCases } from "@/db/schema";
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

  const cases = await db
    .select()
    .from(testCases)
    .where(eq(testCases.jobId, jobId));

  return NextResponse.json(cases);
}
