import { pgTable, uuid, varchar, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";

export const outboxMessages = pgTable("outbox_messages", {
    id: uuid("id").defaultRandom().primaryKey(),
    aggregateType: varchar("aggregate_type", { length: 50 }).notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    payload: jsonb("payload").notNull(),
    exchange: varchar("exchange", { length: 100 }).notNull(),
    routingKey: varchar("routing_key", { length: 100 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    statusIndex: index("outbox_status_idx").on(table.status),
    aggregateIndex: index("outbox_aggregate_idx").on(table.aggregateType, table.aggregateId),
    createdAtIndex: index("outbox_created_idx").on(table.createdAt),
}));
