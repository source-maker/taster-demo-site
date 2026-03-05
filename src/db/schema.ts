import { pgTable, uuid, varchar, boolean, timestamp, date, integer, jsonb, text, unique, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quotas = pgTable("quotas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  date: date("date").notNull().defaultNow(),
  generationsUsed: integer("generations_used").default(0),
  casesGenerated: integer("cases_generated").default(0),
}, (table) => [
  unique("uq_quotas_user_date").on(table.userId, table.date),
  index("idx_quotas_user_date").on(table.userId, table.date),
]);

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  command: varchar("command", { length: 20 }).notNull(),
  method: varchar("method", { length: 10 }),
  input: jsonb("input").notNull(),
  status: varchar("status", { length: 20 }).default("pending"),
  exitCode: integer("exit_code"),
  artifacts: jsonb("artifacts"),
  resultSummary: jsonb("result_summary"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_jobs_user").on(table.userId, table.createdAt),
]);

export const testCases = pgTable("test_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  caseId: varchar("case_id", { length: 20 }).notNull(),
  name: text("name").notNull(),
  category: varchar("category", { length: 100 }),
  priority: varchar("priority", { length: 10 }),
  url: text("url"),
  steps: jsonb("steps"),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_test_cases_job").on(table.jobId),
]);

export const testResults = pgTable("test_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  caseId: varchar("case_id", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  durationMs: integer("duration_ms"),
  error: text("error"),
  steps: jsonb("steps"),
  screenshotUrl: text("screenshot_url"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_test_results_job").on(table.jobId),
]);
