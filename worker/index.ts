import { spawn } from "child_process";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Redis from "ioredis";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql as dsql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import "dotenv/config";

const { jobs, testCases, testResults, quotas } = schema;

const redis = new Redis(process.env.REDIS_URL!);
const dbSql = neon(process.env.DATABASE_URL!);
const db = drizzle(dbSql, { schema });

const JOB_QUEUE = "taster:jobs";
const LOG_PREFIX = "taster:logs:";
const LOG_TTL = 3600;
const TASTER_BIN = process.env.TASTER_BIN || "npx";
const TASTER_ARGS = process.env.TASTER_BIN ? [] : ["taster"];
const MAX_CASES = 100;

async function pushLog(jobId: string, message: string) {
  const key = `${LOG_PREFIX}${jobId}`;
  await redis.rpush(key, JSON.stringify({ type: "log", message, ts: Date.now() }));
  await redis.expire(key, LOG_TTL);
}

async function pushDone(jobId: string) {
  const key = `${LOG_PREFIX}${jobId}`;
  await redis.rpush(key, JSON.stringify({ type: "done", ts: Date.now() }));
  await redis.expire(key, LOG_TTL);
}

function runCommand(cmd: string, args: string[], cwd: string, jobId: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: { ...process.env }, shell: true });

    child.stdout.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        pushLog(jobId, line);
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        pushLog(jobId, line);
      }
    });

    child.on("close", (code) => {
      resolve(code ?? 1);
    });

    child.on("error", (err) => {
      pushLog(jobId, `Error: ${err.message}`);
      resolve(1);
    });
  });
}

async function handleGenerate(jobId: string, data: Record<string, unknown>) {
  const input = data.input as Record<string, unknown>;
  const method = data.method as string;
  const userId = data.userId as string;

  // Create temp project directory
  const tmpDir = mkdtempSync(join(tmpdir(), "taster-"));
  const projectName = "demo";

  try {
    await pushLog(jobId, `Initializing project in ${tmpDir}...`);

    // Init taster project
    const initArgs = [
      ...TASTER_ARGS,
      "init", projectName,
      "--url", (input.url as string) || "https://example.com",
      "--force",
    ];
    const initCode = await runCommand(TASTER_BIN, initArgs, tmpDir, jobId);
    if (initCode !== 0) throw new Error(`taster init failed with code ${initCode}`);

    // Generate test cases
    const genArgs = [
      ...TASTER_ARGS,
      "generate-case",
      "--method", method,
      "--project", projectName,
      "--provider", "playwright",
    ];

    if (method === "crawl") {
      genArgs.push("--url", input.url as string);
      if (input.maxPages) genArgs.push("--max-pages", String(input.maxPages));
      if (input.maxDepth) genArgs.push("--max-depth", String(input.maxDepth));
    } else if (method === "repo") {
      genArgs.push("--repo-path", input.repoUrl as string);
    }

    await pushLog(jobId, `Running: taster generate-case --method ${method}`);
    const genCode = await runCommand(TASTER_BIN, genArgs, tmpDir, jobId);

    if (genCode !== 0) throw new Error(`taster generate-case failed with code ${genCode}`);

    // Find generated Excel files
    const testcasesDir = join(tmpDir, "projects", projectName, "testcases");
    const excelFiles = readdirSync(testcasesDir).filter((f) => f.endsWith(".xlsx"));

    if (excelFiles.length === 0) {
      throw new Error("No Excel files generated");
    }

    await pushLog(jobId, `Generated ${excelFiles.length} Excel file(s)`);

    // Parse the generated Excel and insert test cases into DB
    // We use a simple approach: run read-case with --dry-run to parse, then extract from stdout
    // For now, insert placeholder cases based on Excel parsing
    const XLSX = await import("xlsx");
    let caseCount = 0;

    for (const file of excelFiles) {
      const workbook = XLSX.readFile(join(testcasesDir, file));
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      for (const row of rows) {
        if (caseCount >= MAX_CASES) {
          await pushLog(jobId, `Reached maximum case limit (${MAX_CASES})`);
          break;
        }

        const caseId = String(row["id"] || row["case_id"] || `AG-${String(caseCount + 1).padStart(3, "0")}`);

        // Get steps from Steps sheet if available
        let steps: unknown[] = [];
        const stepsSheet = workbook.Sheets["Steps"];
        if (stepsSheet) {
          const allSteps = XLSX.utils.sheet_to_json<Record<string, unknown>>(stepsSheet);
          steps = allSteps.filter((s) => String(s["case_id"]) === caseId);
        }

        await db.insert(testCases).values({
          jobId,
          userId,
          caseId,
          name: String(row["name"] || row["テスト名"] || "Unnamed"),
          category: String(row["category"] || row["カテゴリ"] || ""),
          priority: String(row["priority"] || row["優先度"] || "medium"),
          url: String(row["url"] || ""),
          steps,
          enabled: true,
        });

        caseCount++;
      }
    }

    await pushLog(jobId, `Inserted ${caseCount} test cases`);

    // Update quota
    const today = new Date().toISOString().split("T")[0];
    await db
      .update(quotas)
      .set({ casesGenerated: dsql`${quotas.casesGenerated} + ${caseCount}` })
      .where(eq(quotas.userId, userId));

    // Mark job as completed
    await db.update(jobs).set({
      status: "completed",
      exitCode: 0,
      completedAt: new Date(),
    }).where(eq(jobs.id, jobId));

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await pushLog(jobId, `Error: ${message}`);
    await db.update(jobs).set({
      status: "failed",
      exitCode: 1,
      completedAt: new Date(),
    }).where(eq(jobs.id, jobId));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
    await pushDone(jobId);
  }
}

async function handleRun(jobId: string, data: Record<string, unknown>) {
  const cases = data.cases as Array<{ caseId: string; name: string; url: string; steps: unknown[] }>;
  const tmpDir = mkdtempSync(join(tmpdir(), "taster-run-"));
  const projectName = "demo";

  try {
    // Init taster project
    const targetUrl = cases[0]?.url || "https://example.com";
    const initArgs = [...TASTER_ARGS, "init", projectName, "--url", targetUrl, "--force"];
    const initCode = await runCommand(TASTER_BIN, initArgs, tmpDir, jobId);
    if (initCode !== 0) throw new Error(`taster init failed with code ${initCode}`);

    // Run read-case to generate Playwright specs
    const readArgs = [...TASTER_ARGS, "read-case", "--project", projectName, "--provider", "playwright"];
    await pushLog(jobId, "Generating Playwright specs...");
    await runCommand(TASTER_BIN, readArgs, tmpDir, jobId);

    // Run tests
    const runArgs = [...TASTER_ARGS, "run-case", "--project", projectName, "--provider", "playwright"];
    await pushLog(jobId, "Running Playwright tests...");
    const runCode = await runCommand(TASTER_BIN, runArgs, tmpDir, jobId);

    // Parse results
    const resultsDir = join(tmpDir, "projects", projectName, "results");
    let resultDirs: string[] = [];
    try {
      resultDirs = readdirSync(resultsDir);
    } catch {
      // No results directory
    }

    if (resultDirs.length > 0) {
      const latestDir = join(resultsDir, resultDirs[resultDirs.length - 1]);
      try {
        const summaryPath = join(latestDir, "summary.json");
        const summary = JSON.parse(readFileSync(summaryPath, "utf-8"));

        if (summary.results) {
          for (const result of summary.results) {
            await db.insert(testResults).values({
              jobId,
              caseId: result.id || result.caseId,
              status: result.status || "error",
              durationMs: result.durationMs || 0,
              error: result.error || null,
              steps: result.steps || [],
              screenshotUrl: null,
            });
          }
        }

        await db.update(jobs).set({
          status: "completed",
          exitCode: runCode,
          resultSummary: {
            total: summary.total,
            passed: summary.passed,
            failed: summary.failed,
            durationMs: summary.durationMs,
          },
          completedAt: new Date(),
        }).where(eq(jobs.id, jobId));

        await pushLog(jobId, `Results: ${summary.passed} passed, ${summary.failed} failed`);
      } catch (parseErr) {
        await pushLog(jobId, `Warning: Could not parse results JSON`);
      }
    }

    // If no results were parsed, still mark as completed
    const [currentJob] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (currentJob?.status !== "completed") {
      await db.update(jobs).set({
        status: runCode === 0 ? "completed" : "failed",
        exitCode: runCode,
        completedAt: new Date(),
      }).where(eq(jobs.id, jobId));
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await pushLog(jobId, `Error: ${message}`);
    await db.update(jobs).set({
      status: "failed",
      exitCode: 1,
      completedAt: new Date(),
    }).where(eq(jobs.id, jobId));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
    await pushDone(jobId);
  }
}

async function main() {
  console.log("Worker started, waiting for jobs...");

  while (true) {
    try {
      const result = await redis.brpop(JOB_QUEUE, 30);
      if (!result) continue;

      const data = JSON.parse(result[1]);
      const { jobId, command } = data;

      console.log(`Processing job ${jobId} (${command})`);

      // Mark as running
      await db.update(jobs).set({
        status: "running",
        startedAt: new Date(),
      }).where(eq(jobs.id, jobId));

      if (command === "generate") {
        await handleGenerate(jobId, data);
      } else if (command === "run") {
        await handleRun(jobId, data);
      } else {
        await pushLog(jobId, `Unknown command: ${command}`);
        await pushDone(jobId);
      }
    } catch (err) {
      console.error("Worker error:", err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

main();
