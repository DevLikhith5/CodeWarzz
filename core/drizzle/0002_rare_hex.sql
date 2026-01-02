ALTER TABLE "users" ADD COLUMN "solved_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "refresh_token_idx" ON "users" USING btree ("refresh_token");