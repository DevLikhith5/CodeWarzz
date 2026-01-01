import { pgTable, foreignKey, uuid, integer, timestamp, text, boolean, unique, varchar, json, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const difficulty = pgEnum("difficulty", ['EASY', 'MEDIUM', 'HARD'])
export const language = pgEnum("language", ['cpp', 'java', 'python', 'javascript', 'go', 'rust'])
export const verdict = pgEnum("verdict", ['AC', 'WA', 'TLE', 'MLE', 'RE', 'CE', 'PENDING'])


export const leaderboardSnapshots = pgTable("leaderboard_snapshots", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	contestId: uuid("contest_id").notNull(),
	userId: uuid("user_id").notNull(),
	score: integer().notNull(),
	rank: integer().notNull(),
	timeTakenMs: integer("time_taken_ms").notNull(),
	capturedAt: timestamp("captured_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.contestId],
			foreignColumns: [contests.id],
			name: "leaderboard_snapshots_contest_id_contests_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "leaderboard_snapshots_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const testcases = pgTable("testcases", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	problemId: uuid("problem_id").notNull(),
	input: text().notNull(),
	output: text().notNull(),
	isSample: boolean("is_sample").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.problemId],
			foreignColumns: [problems.id],
			name: "testcases_problem_id_problems_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	username: varchar({ length: 50 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	role: varchar({ length: 20 }).default('user').notNull(),
	refreshToken: varchar("refresh_token", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const submissions = pgTable("submissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	problemId: uuid("problem_id").notNull(),
	contestId: uuid("contest_id"),
	language: language().notNull(),
	code: text().notNull(),
	verdict: verdict().notNull(),
	score: integer().default(0).notNull(),
	timeTakenMs: integer("time_taken_ms").notNull(),
	memoryUsedMb: integer("memory_used_mb"),
	passedTestcases: integer("passed_testcases").notNull(),
	totalTestcases: integer("total_testcases").notNull(),
	failedInput: text("failed_input"),
	failedExpected: text("failed_expected"),
	failedOutput: text("failed_output"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "submissions_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.problemId],
			foreignColumns: [problems.id],
			name: "submissions_problem_id_problems_id_fk"
		}),
	foreignKey({
			columns: [table.contestId],
			foreignColumns: [contests.id],
			name: "submissions_contest_id_contests_id_fk"
		}),
]);

export const contests = pgTable("contests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	startTime: timestamp("start_time", { mode: 'string' }).notNull(),
	endTime: timestamp("end_time", { mode: 'string' }).notNull(),
	isFrozen: boolean("is_frozen").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	slug: varchar({ length: 255 }).notNull(),
}, (table) => [
	unique("contests_slug_unique").on(table.slug),
]);

export const problems = pgTable("problems", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	difficulty: difficulty().notNull(),
	maxScore: integer("max_score").default(100).notNull(),
	timeLimitMs: integer("time_limit_ms").default(2000).notNull(),
	memoryLimitMb: integer("memory_limit_mb").default(256).notNull(),
	cpuLimit: integer("cpu_limit").default(1).notNull(),
	stackLimitMb: integer("stack_limit_mb"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	tags: json().default([]),
	hints: json().default([]),
}, (table) => [
	unique("problems_slug_unique").on(table.slug),
]);

export const contestProblems = pgTable("contest_problems", {
	contestId: uuid("contest_id").notNull(),
	problemId: uuid("problem_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.contestId],
			foreignColumns: [contests.id],
			name: "contest_problems_contest_id_contests_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.problemId],
			foreignColumns: [problems.id],
			name: "contest_problems_problem_id_problems_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.contestId, table.problemId], name: "contest_problems_contest_id_problem_id_pk"}),
]);

export const contestRegistrations = pgTable("contest_registrations", {
	contestId: uuid("contest_id").notNull(),
	userId: uuid("user_id").notNull(),
	registeredAt: timestamp("registered_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.contestId],
			foreignColumns: [contests.id],
			name: "contest_registrations_contest_id_contests_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "contest_registrations_user_id_users_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.contestId, table.userId], name: "contest_registrations_contest_id_user_id_pk"}),
]);

export const userDailyActivity = pgTable("user_daily_activity", {
	userId: uuid("user_id").notNull(),
	date: timestamp({ mode: 'string' }).notNull(),
	submissions: integer().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	primaryKey({ columns: [table.userId, table.date], name: "user_daily_activity_user_id_date_pk"}),
]);
