"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface LogEntry {
  type: "log" | "done";
  message?: string;
}

interface TestCase {
  id: string;
  caseId: string;
  name: string;
  category: string | null;
  priority: string | null;
  url: string | null;
  steps: unknown[];
  enabled: boolean;
}

interface TestResult {
  id: string;
  caseId: string;
  status: string;
  durationMs: number | null;
  error: string | null;
  steps: unknown[];
  screenshotUrl: string | null;
}

type Tab = "crawl" | "repo";
type Phase = "input" | "generating" | "cases" | "running" | "results";

export default function DemoPage() {
  const [tab, setTab] = useState<Tab>("crawl");
  const [phase, setPhase] = useState<Phase>("input");

  // Input state
  const [url, setUrl] = useState("");
  const [maxDepth, setMaxDepth] = useState(3);
  const [repoUrl, setRepoUrl] = useState("");

  // Job state
  const [generateJobId, setGenerateJobId] = useState<string | null>(null);
  const [runJobId, setRunJobId] = useState<string | null>(null);

  // Data state
  const [logs, setLogs] = useState<string[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // SSE log streaming
  const streamLogs = useCallback((jobId: string, onDone: () => void) => {
    const eventSource = new EventSource(`/api/jobs/${jobId}/stream`);

    eventSource.onmessage = (event) => {
      const data: LogEntry = JSON.parse(event.data);
      if (data.type === "done") {
        eventSource.close();
        onDone();
        return;
      }
      if (data.message) {
        setLogs((prev) => [...prev, data.message!]);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      onDone();
    };

    return eventSource;
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setLogs([]);
    setCases([]);
    setResults([]);

    const body = tab === "crawl"
      ? { method: "crawl", url, maxDepth }
      : { method: "repo", repoUrl };

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    setGenerateJobId(data.jobId);
    setPhase("generating");
    setLogs(["$ taster generate-case --method " + tab]);

    streamLogs(data.jobId, async () => {
      // Fetch generated test cases
      const casesRes = await fetch(`/api/jobs/${data.jobId}/cases`);
      const casesData = await casesRes.json();
      setCases(casesData);
      setPhase("cases");
      setLoading(false);
    });
  }

  async function handleRun() {
    if (!generateJobId) return;
    setLoading(true);
    setError("");
    setResults([]);
    setLogs((prev) => [...prev, "", "$ taster run-case --provider playwright"]);

    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generateJobId }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    setRunJobId(data.jobId);
    setPhase("running");

    streamLogs(data.jobId, async () => {
      // Fetch results
      const resultsRes = await fetch(`/api/jobs/${data.jobId}/results`);
      const resultsData = await resultsRes.json();
      setResults(resultsData);
      setPhase("results");
      setLoading(false);
    });
  }

  function handleReset() {
    setPhase("input");
    setLogs([]);
    setCases([]);
    setResults([]);
    setGenerateJobId(null);
    setRunJobId(null);
    setError("");
  }

  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const totalDuration = results.reduce((sum, r) => sum + (r.durationMs || 0), 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Taster Demo</h1>
          <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-300">
            リセット
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Tab + Input Form */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setTab("crawl")}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                tab === "crawl"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              URL入力
            </button>
            <button
              onClick={() => setTab("repo")}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                tab === "repo"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              ソースコード
            </button>
          </div>

          <form onSubmit={handleGenerate} className="p-6">
            {tab === "crawl" ? (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">URL</label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    required
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-gray-500 mb-1">Depth</label>
                  <input
                    type="number"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    min={1}
                    max={5}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  GitHub URL
                </label>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  required
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || phase !== "input"}
              className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {loading && phase === "generating" ? "生成中..." : "Generate Test Cases"}
            </button>
          </form>
        </section>

        {/* Terminal */}
        {logs.length > 0 && (
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs text-gray-500 ml-2">Terminal</span>
            </div>
            <div
              ref={terminalRef}
              className="p-4 font-mono text-sm text-green-400 max-h-80 overflow-y-auto"
            >
              {logs.map((line, i) => (
                <div key={i} className={line.startsWith("$") ? "text-gray-400" : ""}>
                  {line || "\u00A0"}
                </div>
              ))}
              {(phase === "generating" || phase === "running") && (
                <div className="animate-pulse">▌</div>
              )}
            </div>
          </section>
        )}

        {/* Generated Test Cases */}
        {cases.length > 0 && (
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-medium">Generated Test Cases ({cases.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-left border-b border-gray-800">
                    <th className="px-6 py-3 font-medium">ID</th>
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Category</th>
                    <th className="px-6 py-3 font-medium">Priority</th>
                    <th className="px-6 py-3 font-medium">Steps</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-6 py-3 text-blue-400 font-mono">{c.caseId}</td>
                      <td className="px-6 py-3">{c.name}</td>
                      <td className="px-6 py-3 text-gray-400">{c.category || "-"}</td>
                      <td className="px-6 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            c.priority === "high"
                              ? "bg-red-500/20 text-red-400"
                              : c.priority === "medium"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {c.priority || "medium"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-400">
                        {Array.isArray(c.steps) ? c.steps.length : 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {phase === "cases" && (
              <div className="px-6 py-4 border-t border-gray-800">
                <button
                  onClick={handleRun}
                  disabled={loading}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                >
                  Run Tests
                </button>
              </div>
            )}
          </section>
        )}

        {/* Results Dashboard */}
        {results.length > 0 && (
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="font-medium mb-3">Test Results</h2>
              <div className="flex gap-6 text-sm">
                <span className="text-gray-400">
                  Total: <span className="text-white font-medium">{results.length}</span>
                </span>
                <span className="text-green-400">
                  Passed: <span className="font-medium">{passed}</span>
                </span>
                <span className="text-red-400">
                  Failed: <span className="font-medium">{failed}</span>
                </span>
                <span className="text-gray-400">
                  Duration: <span className="text-white font-medium">{(totalDuration / 1000).toFixed(1)}s</span>
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-800/50">
              {results.map((r) => (
                <div key={r.id} className="px-6 py-4 hover:bg-gray-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          r.status === "passed"
                            ? "bg-green-500/20 text-green-400"
                            : r.status === "failed"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {r.status.toUpperCase()}
                      </span>
                      <span className="font-mono text-sm text-blue-400">{r.caseId}</span>
                      <span className="text-sm">
                        {cases.find((c) => c.caseId === r.caseId)?.name || r.caseId}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "-"}
                    </span>
                  </div>
                  {r.error && (
                    <div className="mt-2 p-3 bg-red-500/10 rounded-lg text-sm text-red-300 font-mono">
                      {r.error}
                    </div>
                  )}
                  {r.screenshotUrl && (
                    <div className="mt-2">
                      <a
                        href={r.screenshotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline"
                      >
                        スクリーンショットを表示
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Error display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-6 py-4 text-red-400 text-sm">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
