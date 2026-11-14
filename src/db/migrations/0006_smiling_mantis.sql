CREATE TABLE "share_viewers" (
	"share_id" uuid NOT NULL,
	"viewer_hash" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "share_viewers_share_id_viewer_hash_pk" PRIMARY KEY("share_id","viewer_hash")
);
--> statement-breakpoint
ALTER TABLE "share_viewers" ADD CONSTRAINT "share_viewers_share_id_share_links_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "share_viewers_live" ON "share_viewers" USING btree ("share_id","last_seen_at");