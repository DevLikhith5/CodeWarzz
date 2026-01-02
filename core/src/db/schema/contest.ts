import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { users } from "./user";
import { problems } from "./problems";

export const contests = pgTable("contests", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description").notNull(),

  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isFrozen: boolean("is_frozen").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contestProblems = pgTable(
  "contest_problems",
  {
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    problemId: uuid("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey(t.contestId, t.problemId),
  })
);

export const contestRegistrations = pgTable(
  "contest_registrations",
  {
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    registeredAt: timestamp("registered_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey(t.contestId, t.userId),
  })
);
