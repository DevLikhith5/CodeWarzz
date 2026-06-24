import { pgTable, uuid, varchar, doublePrecision, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

export const codeFingerprints = pgTable("code_fingerprints", {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id").notNull().unique(),
    language: varchar("language", { length: 20 }).notNull(),
    normalizedCode: text("normalized_code").notNull(),
    fingerprintHashes: text("fingerprint_hashes").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    submissionIdIndex: index("fingerprint_submission_idx").on(table.submissionId),
}));

export const plagiarismReports = pgTable("plagiarism_reports", {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId1: uuid("submission_id_1").notNull(),
    submissionId2: uuid("submission_id_2").notNull(),
    problemId: uuid("problem_id").notNull(),
    contestId: uuid("contest_id"),
    similarityScore: doublePrecision("similarity_score").notNull(),
    flagged: boolean("flagged").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    // Unique on the (submission1, submission2) pair so a retried check
    // can use INSERT ... ON CONFLICT DO NOTHING without producing dupes.
    pairUnique: uniqueIndex("plagiarism_pair_uq").on(table.submissionId1, table.submissionId2),
    problemIndex: index("plagiarism_problem_idx").on(table.problemId),
    contestIndex: index("plagiarism_contest_idx").on(table.contestId),
    flaggedIndex: index("plagiarism_flagged_idx").on(table.flagged),
}));
