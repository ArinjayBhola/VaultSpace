ALTER TABLE "files" ADD COLUMN "processing_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN "generation" integer DEFAULT 0 NOT NULL;