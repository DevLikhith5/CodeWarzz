import { relations } from "drizzle-orm/relations";
import { contests, leaderboardSnapshots, users, problems, testcases, submissions, contestProblems, contestRegistrations } from "./schema";

export const leaderboardSnapshotsRelations = relations(leaderboardSnapshots, ({one}) => ({
	contest: one(contests, {
		fields: [leaderboardSnapshots.contestId],
		references: [contests.id]
	}),
	user: one(users, {
		fields: [leaderboardSnapshots.userId],
		references: [users.id]
	}),
}));

export const contestsRelations = relations(contests, ({many}) => ({
	leaderboardSnapshots: many(leaderboardSnapshots),
	submissions: many(submissions),
	contestProblems: many(contestProblems),
	contestRegistrations: many(contestRegistrations),
}));

export const usersRelations = relations(users, ({many}) => ({
	leaderboardSnapshots: many(leaderboardSnapshots),
	submissions: many(submissions),
	contestRegistrations: many(contestRegistrations),
}));

export const testcasesRelations = relations(testcases, ({one}) => ({
	problem: one(problems, {
		fields: [testcases.problemId],
		references: [problems.id]
	}),
}));

export const problemsRelations = relations(problems, ({many}) => ({
	testcases: many(testcases),
	submissions: many(submissions),
	contestProblems: many(contestProblems),
}));

export const submissionsRelations = relations(submissions, ({one}) => ({
	user: one(users, {
		fields: [submissions.userId],
		references: [users.id]
	}),
	problem: one(problems, {
		fields: [submissions.problemId],
		references: [problems.id]
	}),
	contest: one(contests, {
		fields: [submissions.contestId],
		references: [contests.id]
	}),
}));

export const contestProblemsRelations = relations(contestProblems, ({one}) => ({
	contest: one(contests, {
		fields: [contestProblems.contestId],
		references: [contests.id]
	}),
	problem: one(problems, {
		fields: [contestProblems.problemId],
		references: [problems.id]
	}),
}));

export const contestRegistrationsRelations = relations(contestRegistrations, ({one}) => ({
	contest: one(contests, {
		fields: [contestRegistrations.contestId],
		references: [contests.id]
	}),
	user: one(users, {
		fields: [contestRegistrations.userId],
		references: [users.id]
	}),
}));