"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setStep("code");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }

    router.push("/demo");
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Taster Demo</h1>
          <p className="text-gray-400">AI E2E テスト自動生成</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
          {step === "email" ? (
            <form onSubmit={handleRegister}>
              <label className="block text-sm text-gray-400 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {loading ? "送信中..." : "認証コードを送信"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify}>
              <p className="text-gray-400 text-sm mb-4">
                <span className="text-white">{email}</span> に認証コードを送信しました
              </p>
              <label className="block text-sm text-gray-400 mb-2">
                認証コード (6桁)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-center text-2xl tracking-widest focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {loading ? "検証中..." : "認証する"}
              </button>
              <button
                type="button"
                onClick={() => setStep("email")}
                className="w-full mt-2 text-sm text-gray-500 hover:text-gray-300"
              >
                メールアドレスを変更
              </button>
            </form>
          )}

          {error && (
            <p className="mt-4 text-red-400 text-sm text-center">{error}</p>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          1日1回・100ケースまで無料でお試しいただけます
        </p>
      </div>
    </div>
  );
}
