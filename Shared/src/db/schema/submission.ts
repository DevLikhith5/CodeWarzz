import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./user";
import { problems } from "./problems";
import { contests } from "./contest";
import { verdictEnum, languageEnum } from "./enums";

export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),

  problemId: uuid("problem_id")
    .notNull()
    .references(() => problems.id),

  contestId: uuid("contest_id")
    .references(() => contests.id),

  language: languageEnum("language").notNull(),
  code: text("code").notNull(),

  verdict: verdictEnum("verdict").notNull(),
  score: integer("score").default(0).notNull(),

  timeTakenMs: integer("time_taken_ms").notNull(),
  memoryUsedMb: integer("memory_used_mb"),

  passedTestcases: integer("passed_testcases").notNull(),
  totalTestcases: integer("total_testcases").notNull(),

  failedInput: text("failed_input"),
  failedExpected: text("failed_expected"),
  failedOutput: text("failed_output"),
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
