import { relations } from "drizzle-orm";
import { userDailyActivity, users } from "./user";
import { submissions } from "./submission";
import { contests, contestRegistrations, contestProblems } from "./contest";
import { problems, testcases } from "./problems";
import { leaderboardSnapshots } from "./leaderboard";

//one to many
export const usersRelations = relations(users, ({ many }) => ({
    submissions: many(submissions),
    registrations: many(contestRegistrations),
    leaderboardSnapshots: many(leaderboardSnapshots),
}));

//one to many
export const contestsRelations = relations(contests, ({ many }) => ({
    submissions: many(submissions),
    registrations: many(contestRegistrations),
    problems: many(contestProblems), 
    leaderboardSnapshots: many(leaderboardSnapshots),
}));

//one to many
export const problemsRelations = relations(problems, ({ many }) => ({
    submissions: many(submissions),
    testcases: many(testcases),
    contests: many(contestProblems), 
}));

//many to one
export const submissionsRelations = relations(submissions, ({ one }) => ({
    user: one(users, {
        fields: [submissions.userId],
        references: [users.id],
    }),
    problem: one(problems, {
        fields: [submissions.problemId],
        references: [problems.id],
    }),
    contest: one(contests, {
        fields: [submissions.contestId],
        references: [contests.id],
    }),
}));

//many to one
export const contestRegistrationsRelations = relations(contestRegistrations, ({ one }) => ({
    contest: one(contests, {
        fields: [contestRegistrations.contestId],
        references: [contests.id],
    }),
    user: one(users, {
        fields: [contestRegistrations.userId],
        references: [users.id],
    }),
}));

//many to one
export const contestProblemsRelations = relations(contestProblems, ({ one }) => ({
    contest: one(contests, {
        fields: [contestProblems.contestId],
        references: [contests.id],
    }),
    problem: one(problems, {
        fields: [contestProblems.problemId],
        references: [problems.id],
    }),
}));

//many to one
export const testcasesRelations = relations(testcases, ({ one }) => ({
    problem: one(problems, {
        fields: [testcases.problemId],
        references: [problems.id],
    }),
}));

//many to one
export const leaderboardSnapshotsRelations = relations(leaderboardSnapshots, ({ one }) => ({
    contest: one(contests, {
        fields: [leaderboardSnapshots.contestId],
        references: [contests.id],
    }),
    user: one(users, {
        fields: [leaderboardSnapshots.userId],
        references: [users.id],
    }),
}));

//many to one
export const userDailyActivityRelations = relations(userDailyActivity, ({ one }) => ({
    user: one(users, {
        fields: [userDailyActivity.userId],
        references: [users.id],
    }),
}));