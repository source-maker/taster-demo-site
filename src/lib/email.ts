import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendVerificationCode(email: string, code: string) {
  await getResend().emails.send({
    from: "Taster Demo <onboarding@resend.dev>",
    to: email,
    subject: "認証コード - Taster Demo",
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        <h2>Taster Demo 認証コード</h2>
        <p>以下のコードを入力してください:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f0f0f0; border-radius: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px;">このコードは10分間有効です。</p>
      </div>
    `,
  });
}

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
