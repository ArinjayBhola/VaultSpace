CREATE TABLE "folder_unlocks" (
	"folder_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "folder_unlocks_folder_id_session_id_pk" PRIMARY KEY("folder_id","session_id")
);
--> statement-breakpoint
ALTER TABLE "folders" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "folder_unlocks" ADD CONSTRAINT "folder_unlocks_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_unlocks" ADD CONSTRAINT "folder_unlocks_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folder_unlocks_session" ON "folder_unlocks" USING btree ("session_id","expires_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION vault_folder_access(target_id uuid, current_session text) RETURNS boolean LANGUAGE sql STABLE AS $$
 WITH RECURSIVE path AS (SELECT id,parent_id,password_hash FROM folders WHERE id=target_id UNION ALL SELECT f.id,f.parent_id,f.password_hash FROM folders f JOIN path p ON p.parent_id=f.id)
 SELECT NOT EXISTS(SELECT 1 FROM path p WHERE p.password_hash IS NOT NULL AND NOT EXISTS(SELECT 1 FROM folder_unlocks u WHERE u.folder_id=p.id AND u.session_id=current_session AND u.expires_at>now()));
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION vault_folder_protected(target_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 WITH RECURSIVE path AS (SELECT id,parent_id,password_hash FROM folders WHERE id=target_id UNION ALL SELECT f.id,f.parent_id,f.password_hash FROM folders f JOIN path p ON p.parent_id=f.id)
 SELECT EXISTS(SELECT 1 FROM path WHERE password_hash IS NOT NULL);
$$;
