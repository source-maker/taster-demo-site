import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendVerificationCode, generateCode } from "@/lib/email";
import { storeCode } from "@/lib/queue";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Upsert user
  const existing = await db().select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing.length === 0) {
    await db().insert(users).values({ email: normalizedEmail });
  }

  // Generate and store verification code
  const code = generateCode();
  await storeCode(normalizedEmail, code);

  // Send email
  try {
    await sendVerificationCode(normalizedEmail, code);
  } catch (e) {
    console.error("Failed to send email:", e);
    return NextResponse.json({ error: "メール送信に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
