import {
    pgTable,
    uuid,
    varchar,
    timestamp,
    integer,
    primaryKey,
    index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    username: varchar("username", { length: 50 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 }).default("user").notNull(),
    refreshToken: varchar("refresh_token", { length: 255 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
},
    (table) => ({
        refreshTokenIndex: index("refresh_token_idx").on(table.refreshToken)
    }));


export const userDailyActivity = pgTable("user_daily_activity", {
    userId: uuid("user_id").notNull(),
    date: timestamp("date").notNull(),
    submissions: integer("submissions").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),

}, (table) => ({
    pk: primaryKey({ columns: [table.userId, table.date] })
}))