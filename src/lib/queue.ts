import { getRedis } from "./redis";

const JOB_QUEUE = "taster:jobs";
const LOG_PREFIX = "taster:logs:";
const CODE_PREFIX = "taster:code:";
const LOG_TTL = 3600; // 1 hour
const CODE_TTL = 600; // 10 minutes

// Job queue
export async function enqueueJob(jobId: string, data: Record<string, unknown>) {
  const redis = getRedis();
  await redis.lpush(JOB_QUEUE, JSON.stringify({ jobId, ...data }));
}

export async function dequeueJob(): Promise<{ jobId: string; [key: string]: unknown } | null> {
  const redis = getRedis();
  const result = await redis.brpop(JOB_QUEUE, 30);
  if (!result) return null;
  return JSON.parse(result[1]);
}

// Log streaming
export async function pushLog(jobId: string, message: string) {
  const redis = getRedis();
  const key = `${LOG_PREFIX}${jobId}`;
  await redis.rpush(key, JSON.stringify({ type: "log", message, ts: Date.now() }));
  await redis.expire(key, LOG_TTL);
}

export async function pushDone(jobId: string) {
  const redis = getRedis();
  const key = `${LOG_PREFIX}${jobId}`;
  await redis.rpush(key, JSON.stringify({ type: "done", ts: Date.now() }));
  await redis.expire(key, LOG_TTL);
}

export async function getLogs(jobId: string, fromIndex: number): Promise<string[]> {
  const redis = getRedis();
  const key = `${LOG_PREFIX}${jobId}`;
  return redis.lrange(key, fromIndex, -1);
}

// Verification codes
export async function storeCode(email: string, code: string) {
  const redis = getRedis();
  await redis.set(`${CODE_PREFIX}${email}`, code, "EX", CODE_TTL);
}

export async function verifyCode(email: string, code: string): Promise<boolean> {
  const redis = getRedis();
  const stored = await redis.get(`${CODE_PREFIX}${email}`);
  if (stored === code) {
    await redis.del(`${CODE_PREFIX}${email}`);
    return true;
  }
  return false;
}
