import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyCode } from "@/lib/queue";
import { createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  if (!email || !code) {
    return NextResponse.json({ error: "メールアドレスと認証コードを入力してください" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const valid = await verifyCode(normalizedEmail, code);
  if (!valid) {
    return NextResponse.json({ error: "認証コードが無効です" }, { status: 401 });
  }

  // Mark user as verified
  await db().update(users).set({ verified: true }).where(eq(users.email, normalizedEmail));

  // Get user
  const [user] = await db().select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  // Create session
  await createSession({ userId: user.id, email: normalizedEmail });

  return NextResponse.json({ ok: true, userId: user.id });
}
