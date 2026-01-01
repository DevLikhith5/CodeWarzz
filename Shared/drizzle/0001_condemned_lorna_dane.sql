ALTER TYPE "public"."verdict" ADD VALUE 'PENDING';--> statement-breakpoint
CREATE TABLE "user_daily_activity" (
	"user_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"submissions" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_daily_activity_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_username_unique";--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "slug" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "time_limit_ms" integer DEFAULT 2000 NOT NULL;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "memory_limit_mb" integer DEFAULT 256 NOT NULL;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "cpu_limit" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "stack_limit_mb" integer;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "tags" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "hints" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_slug_unique" UNIQUE("slug");