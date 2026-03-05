# Taster Demo Site - CLI繋ぎ込みアーキテクチャ

## Context

taster-demo-site（現在は静的HTML）を実際のtaster CLIバックエンドに接続し、ユーザーがURL or ソースコードを入力するとE2Eテストケース（Excel）を自動生成し、Playwrightで実行して結果を返すデモサイトを構築する。

**スコープ:**
- generate-case（AI テストケース生成）→ read-case（Playwright spec生成）→ run-case（テスト実行）のフロー
- Datadog連携はデモでは対象外（Playwrightのみ）
- メアド登録制、1日1回・100ケースまでの制限

---

## システム構成図

```
┌──────────────────────────────────────────────┐
│              Vercel (Frontend)                │
│  ┌────────────────────────────────────────┐   │
│  │  Next.js App (App Router)              │   │
│  │  - LP / デモフォーム                     │   │
│  │  - API Routes (job dispatch, auth)     │   │
│  │  - SSE endpoint (Edge Function)        │   │
│  └──────────┬─────────────────────────────┘   │
└─────────────┼─────────────────────────────────┘
              │
   ┌──────────┼──────────┬──────────────────┐
   │          │          │                  │
┌──▼───┐  ┌──▼──────┐  ┌▼───────────┐  ┌───▼──────────┐
│Upstash│  │  Neon   │  │Vercel Blob │  │ Resend       │
│Redis  │  │Postgres │  │(Files)     │  │ (Email)      │
│(Queue │  │(DB)     │  │- Excel     │  │ - Magic Link │
│+Logs) │  │- users  │  │- spec.ts   │  │ - 認証コード  │
│       │  │- jobs   │  │- results   │  │              │
│       │  │- quotas │  │- screenshots│  │              │
└──┬────┘  └─────────┘  └────────────┘  └──────────────┘
   │
┌──▼────────────┐
│   Fly.io      │
│   (Worker)    │
│   - taster CLI│
│   - Chromium  │
│   - Node.js   │
└───────────────┘
```

---

## ユーザーフロー

```
1. LP にアクセス
2. メールアドレス登録（Magic Link or 認証コード）
3. 入力フォーム:
   ├─ Method A: URL を入力 → サイトクローリング → テストケース生成
   └─ Method B: GitHub URL or ソースコード貼り付け → リポジトリ解析 → テストケース生成
4. ターミナル風UIでリアルタイム進捗表示
5. 生成結果:
   ├─ テストケース一覧（テーブル表示 + Excelダウンロード）
   └─ 「テスト実行」ボタン
6. Playwright でテスト実行 → 結果ダッシュボード表示
   ├─ Pass/Fail サマリー
   ├─ 各ケースの詳細（ステップ結果、エラー、スクリーンショット）
   └─ 結果JSONダウンロード
```

---

## 技術選定

| 役割 | 選定 | 理由 |
|------|------|------|
| Frontend | Next.js (App Router) on Vercel | SSR, API Routes, Edge Function, Blob統合 |
| DB | Neon Postgres + Drizzle ORM | 無料枠0.5GB、サーバーレスドライバー、Vercel Edge対応 |
| Job Queue + Logs | Upstash Redis | 無料枠10K cmd/day、RPUSH/LRANGEでログバッファ |
| Worker | Fly.io | Docker + Playwright Chromium、auto-stop、~$5-10/mo |
| File Storage | Vercel Blob | Vercel Pro内包、CDN配信、シンプルAPI |
| Email認証 | Resend | 無料枠100通/日、Vercel連携良好 |
| Real-time | SSE (Vercel Edge Function) | 単方向ストリーム、EventSource API、シンプル |

**月額見積: ~$25-45/mo**（Vercel Pro $20 + Fly.io ~$5-10 + Anthropic API ~$5-15）

---

## DB スキーマ

```sql
-- ユーザー（メアド登録）
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 利用制限トラッキング
CREATE TABLE quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  generations_used INTEGER DEFAULT 0,
  cases_generated INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

-- ジョブ（generate-case, run-case）
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  command VARCHAR(20) NOT NULL,        -- 'generate' | 'run'
  method VARCHAR(10),                  -- 'crawl' | 'repo' (generateの場合)
  input JSONB NOT NULL,                -- {url, depth, ...} or {repoUrl, framework, ...}
  status VARCHAR(20) DEFAULT 'pending', -- pending|running|completed|failed
  exit_code INTEGER,
  artifacts JSONB,                     -- [{type, blobUrl, filename}]
  result_summary JSONB,                -- TestRunSummary (runの場合)
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 生成されたテストケース
CREATE TABLE test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  case_id VARCHAR(20) NOT NULL,         -- AG-001
  name TEXT NOT NULL,
  category VARCHAR(100),
  priority VARCHAR(10),
  url TEXT,
  steps JSONB,                          -- TestStep[]
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- テスト実行結果
CREATE TABLE test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) NOT NULL,
  case_id VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,           -- passed|failed|skipped|error
  duration_ms INTEGER,
  error TEXT,
  steps JSONB,                           -- StepResult[]
  screenshot_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_quotas_user_date ON quotas(user_id, date);
CREATE INDEX idx_jobs_user ON jobs(user_id, created_at DESC);
CREATE INDEX idx_test_cases_job ON test_cases(job_id);
CREATE INDEX idx_test_results_job ON test_results(job_id);
```

---

## API Routes

| Endpoint | Method | 説明 | 実行時間 |
|----------|--------|------|----------|
| `/api/auth/register` | POST | メアド登録、認証コード送信 | <2s |
| `/api/auth/verify` | POST | 認証コード検証、セッション発行 | <1s |
| `/api/generate` | POST | generate-caseジョブ投入 | <1s |
| `/api/run` | POST | run-caseジョブ投入 | <1s |
| `/api/jobs/[jobId]` | GET | ジョブ状態取得 | <1s |
| `/api/jobs/[jobId]/stream` | GET | SSEログストリーム (Edge) | long-lived |
| `/api/jobs/[jobId]/cases` | GET | 生成テストケース一覧 | <1s |
| `/api/jobs/[jobId]/results` | GET | 実行結果取得 | <1s |
| `/api/files/[blobPath]` | GET | ファイルダウンロード(Excel等) | <1s |

### 利用制限チェック (middleware)

```
POST /api/generate 時:
1. セッションからuser_id取得
2. quotas テーブルで当日の generations_used を確認
3. generations_used >= 1 → 429 "本日の生成回数上限に達しました"
4. OK → ジョブ投入、generations_used++
```

---

## Worker (Fly.io)

### 処理フロー

```
1. Redis BRPOP で job メッセージ受信
2. DB: status = 'running'
3. 一時ディレクトリ作成、taster init 実行
4. command に応じた処理:

[generate]
  → taster generate-case --method crawl/repo (子プロセス)
  → stdout/stderr を Redis RPUSH でログバッファに蓄積
  → 完了後: 生成Excelを読み取り → test_cases テーブルにINSERT
  → Excelファイルを Vercel Blob にアップロード
  → cases_generated の合計が100超なら途中で打ち切り

[run]
  → 対象test_casesからPlaywright spec生成
  → taster run-case --provider playwright (子プロセス)
  → stdout/stderrをログバッファに蓄積
  → 完了後: 結果JSONパース → test_results テーブルにINSERT
  → スクリーンショットを Vercel Blob にアップロード

5. DB: status = 'completed' or 'failed', artifacts更新
6. Redis RPUSH {type: 'done'}
7. 一時ディレクトリ削除
```

### Dockerfile

```dockerfile
FROM mcr.microsoft.com/playwright:v1.50.0-noble
WORKDIR /app
COPY taster/ ./taster/
COPY worker/ ./worker/
RUN cd taster && npm ci && npm run build
RUN cd worker && npm ci && npm run build
CMD ["node", "worker/dist/index.js"]
```

---

## リアルタイムログ配信

```
Worker                    Upstash Redis              Vercel Edge (SSE)         Browser
  │                           │                           │                      │
  │─── RPUSH logs:{jobId} ───▶│                           │                      │
  │─── RPUSH logs:{jobId} ───▶│                           │                      │
  │                           │◀── LRANGE (200ms poll) ───│                      │
  │                           │─── [log lines] ──────────▶│── SSE data: {} ─────▶│
  │                           │                           │                      │
  │─── RPUSH {type:'done'} ──▶│                           │                      │
  │                           │◀── LRANGE ────────────────│                      │
  │                           │─── [{type:'done'}] ──────▶│── SSE done ─────────▶│
  │                           │                           │── close ────────────▶│
```

Redis listのTTL: 1時間（自動クリーンアップ）

---

## Frontend ページ構成

```
app/
  page.tsx                      # LP（既存デモサイトのデザイン移植）
  auth/
    page.tsx                    # メアド登録 / 認証コード入力
  demo/
    page.tsx                    # メイン画面: 入力フォーム + ターミナル + 結果
  api/
    auth/register/route.ts
    auth/verify/route.ts
    generate/route.ts
    run/route.ts
    jobs/[jobId]/route.ts
    jobs/[jobId]/stream/route.ts  # Edge Function
    jobs/[jobId]/cases/route.ts
    jobs/[jobId]/results/route.ts
```

### メイン画面 (demo/page.tsx) のレイアウト

```
┌─────────────────────────────────────────────────┐
│ [Tab: URL入力] [Tab: ソースコード]                │
│                                                  │
│  ┌─ 入力フォーム ─────────────────────────────┐  │
│  │ URL: [https://____________] [Depth: 3]     │  │
│  │ [Generate Test Cases]                       │  │
│  └─────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Terminal ──────────────────────────────────┐  │
│  │ $ taster generate-case --method crawl       │  │
│  │ Crawling pages...                           │  │
│  │   [1/5] /login ... 3 forms found            │  │
│  │   [2/5] /register ... 2 forms found         │  │
│  │ ...                                         │  │
│  └─────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Generated Test Cases ──────────────────────┐  │
│  │ ID    | Name          | Steps | [Download]  │  │
│  │ AG-001| Login Flow    | 8     |             │  │
│  │ AG-002| Registration  | 10    |             │  │
│  │              [Run Tests]                    │  │
│  └─────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Results Dashboard ─────────────────────────┐  │
│  │ Total: 6 | Passed: 5 | Failed: 1 | 12.4s   │  │
│  │ ─────────────────────────────────────────── │  │
│  │ [PASS] AG-001 Login Flow         5.1s       │  │
│  │ [FAIL] AG-002 Registration       3.2s       │  │
│  │        > screenshot viewer                  │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 認証 & 制限

### メアド認証フロー
1. ユーザーがメールアドレス入力
2. Resend で6桁の認証コードを送信
3. コード入力 → 検証OK → JWTセッションcookie発行
4. セッション有効期限: 24時間

### 利用制限
- **1日1回の生成**: quotas.generations_used でカウント（日付でリセット）
- **100ケースまで**: Worker側でgenerate-case実行中にケース数を監視、100超で打ち切り
- **Rate limit**: Upstash Ratelimit で同一IPから5req/min

---

## 実装フェーズ

### Phase 1: 基盤 (Week 1)
- [ ] Next.js プロジェクト作成（taster-demo-site リポジトリを作り直し or 別リポ）
- [ ] Neon Postgres セットアップ + Drizzle ORM + マイグレーション
- [ ] Upstash Redis セットアップ
- [ ] Vercel Blob セットアップ
- [ ] メアド認証 (Resend + JWT)

### Phase 2: Worker (Week 2)
- [ ] Fly.io worker プロジェクト作成
- [ ] Docker イメージ (Playwright + taster CLI)
- [ ] Redis ジョブ受信 → CLI子プロセス実行
- [ ] ログストリーミング (Redis RPUSH)
- [ ] アーティファクト Upload (Vercel Blob)

### Phase 3: フロントエンド統合 (Week 3)
- [ ] LP移植（既存デザイン活用）
- [ ] 入力フォーム（URL / ソースコード）
- [ ] SSE ストリーミング (Edge Function + useJobStream hook)
- [ ] Terminal コンポーネント
- [ ] テストケーステーブル + Excelダウンロード
- [ ] 「テスト実行」→ 結果ダッシュボード

### Phase 4: 仕上げ (Week 4)
- [ ] 利用制限 (quota check + rate limit)
- [ ] エラーハンドリング、ローディング状態
- [ ] スクリーンショットビューア
- [ ] E2Eテスト
- [ ] デプロイ & 動作確認

---

## 検証方法

1. **ローカル開発**: `next dev` + Docker compose (worker + Redis + Postgres)
2. **generate フロー**: URL入力 → ターミナルにログ表示 → テストケーステーブル表示 → Excel DL
3. **run フロー**: 「テスト実行」→ ターミナルにログ → 結果ダッシュボード → スクリーンショット確認
4. **制限テスト**: 同一メアドで2回目のgenerate → 429エラー表示を確認
5. **E2E**: Playwright テストで全フローを自動検証
