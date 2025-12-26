import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  json,
} from "drizzle-orm/pg-core";
import { difficultyEnum } from "./enums";

export const problems = pgTable("problems", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description").notNull(),
  difficulty: difficultyEnum("difficulty").notNull(),

  maxScore: integer("max_score").default(100).notNull(),

  timeLimitMs: integer("time_limit_ms").default(2000).notNull(),
  memoryLimitMb: integer("memory_limit_mb").default(256).notNull(),
  cpuLimit: integer("cpu_limit").default(1).notNull(),

  stackLimitMb: integer("stack_limit_mb"),

  tags: json("tags").$type<string[]>().default([]),
  hints: json("hints").$type<string[]>().default([]),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const testcases = pgTable("testcases", {
  id: uuid("id").defaultRandom().primaryKey(),
  problemId: uuid("problem_id")
    .notNull()
    .references(() => problems.id, { onDelete: "cascade" }),

  input: text("input").notNull(),
  output: text("output").notNull(),
  isSample: boolean("is_sample").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});
