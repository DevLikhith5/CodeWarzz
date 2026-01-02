import {
  pgTable,
  uuid,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { contests } from "./contest";
import { users } from "./user";

export const leaderboardSnapshots = pgTable("leaderboard_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),

  contestId: uuid("contest_id")
    .notNull()
    .references(() => contests.id, { onDelete: "cascade" }),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  score: integer("score").notNull(),
  rank: integer("rank").notNull(),
  timeTakenMs: integer("time_taken_ms").notNull(),

  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});
