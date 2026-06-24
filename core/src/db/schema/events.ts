import { pgTable, uuid, varchar, timestamp, jsonb, integer, uniqueIndex, index } from "drizzle-orm/pg-core";

export const submissionEvents = pgTable("submission_events", {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id").notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    payload: jsonb("payload").notNull(),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    // Unique constraint prevents two concurrent appends from colliding on
    // the same (submissionId, version) — even if the read-modify-write
    // race in appendEvent is lost, the DB rejects the second insert.
    submissionVersionUnique: uniqueIndex("submission_events_submission_version_uq").on(table.submissionId, table.version),
    submissionIdIndex: index("submission_events_submission_idx").on(table.submissionId),
    eventTypeIndex: index("submission_events_type_idx").on(table.eventType),
}));

export const contestEvents = pgTable("contest_events", {
    id: uuid("id").defaultRandom().primaryKey(),
    contestId: uuid("contest_id").notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    payload: jsonb("payload").notNull(),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    contestVersionUnique: uniqueIndex("contest_events_contest_version_uq").on(table.contestId, table.version),
    contestIdIndex: index("contest_events_contest_idx").on(table.contestId),
    eventTypeIndex: index("contest_events_type_idx").on(table.eventType),
}));

export const userEvents = pgTable("user_events", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    payload: jsonb("payload").notNull(),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    userVersionUnique: uniqueIndex("user_events_user_version_uq").on(table.userId, table.version),
    userIdIndex: index("user_events_user_idx").on(table.userId),
    eventTypeIndex: index("user_events_type_idx").on(table.eventType),
}));

export const problemEvents = pgTable("problem_events", {
    id: uuid("id").defaultRandom().primaryKey(),
    problemId: uuid("problem_id").notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    payload: jsonb("payload").notNull(),
    version: integer("version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    problemVersionUnique: uniqueIndex("problem_events_problem_version_uq").on(table.problemId, table.version),
    problemIdIndex: index("problem_events_problem_idx").on(table.problemId),
    eventTypeIndex: index("problem_events_type_idx").on(table.eventType),
}));
