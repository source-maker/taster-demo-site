import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Taster
        </h1>
        <p className="text-xl text-gray-400 mb-4">
          AI E2E テスト自動生成ツール
        </p>
        <p className="text-gray-500 max-w-2xl mx-auto mb-10">
          URLやソースコードを入力するだけで、AIがE2Eテストケースを自動生成。
          Playwrightで即座に実行し、結果をリアルタイムで確認できます。
        </p>
        <Link
          href="/auth"
          className="inline-block px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-lg"
        >
          無料でデモを試す
        </Link>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="text-2xl mb-3">🔍</div>
            <h3 className="font-semibold mb-2">サイトクローリング</h3>
            <p className="text-sm text-gray-400">
              URLを入力するとサイトを自動巡回し、フォームやリンクを解析してテストケースを生成します。
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="text-2xl mb-3">🤖</div>
            <h3 className="font-semibold mb-2">AI テストケース生成</h3>
            <p className="text-sm text-gray-400">
              Claude AIがページ構造を理解し、実用的なE2Eテストケースを自動で設計します。
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="text-2xl mb-3">🎭</div>
            <h3 className="font-semibold mb-2">Playwright 実行</h3>
            <p className="text-sm text-gray-400">
              生成されたテストケースをPlaywrightで自動実行。結果とスクリーンショットを即座に確認。
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-center mb-12">使い方</h2>
        <div className="space-y-8">
          {[
            { step: "1", title: "メールアドレスを登録", desc: "認証コードで簡単ログイン" },
            { step: "2", title: "URLを入力", desc: "テストしたいサイトのURLを入力するだけ" },
            { step: "3", title: "テストケースを確認", desc: "AIが生成したテストケースを一覧で確認" },
            { step: "4", title: "テストを実行", desc: "ワンクリックでPlaywright実行、結果をリアルタイム表示" },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-6">
              <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold shrink-0">
                {step}
              </div>
              <div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-gray-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-sm text-gray-600">
        Taster Demo &copy; {new Date().getFullYear()} Source Maker
      </footer>
    </div>
  );
}
