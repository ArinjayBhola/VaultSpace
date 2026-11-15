CREATE INDEX "share_links_file_created" ON "share_links" USING btree ("file_id","created_at");
--> statement-breakpoint
SELECT pg_advisory_xact_lock(862198713);
--> statement-breakpoint
WITH ranked AS (
 SELECT id,row_number() OVER (PARTITION BY file_id ORDER BY created_at DESC,id DESC) AS position
 FROM share_links WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())
), revoked AS (
 UPDATE share_links SET revoked_at=now() WHERE id IN(SELECT id FROM ranked WHERE position>1) RETURNING file_id
)
INSERT INTO activity_events(owner_id,file_id,event_type,metadata)
SELECT f.owner_id,r.file_id,'share_revoked',jsonb_build_object('reason','single_active_link_policy','links',count(*))
FROM revoked r JOIN files f ON f.id=r.file_id GROUP BY f.owner_id,r.file_id;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION vault_single_active_share() RETURNS trigger LANGUAGE plpgsql VOLATILE AS $$
BEGIN
 IF NEW.revoked_at IS NULL AND (NEW.expires_at IS NULL OR NEW.expires_at>clock_timestamp()) THEN
   PERFORM pg_advisory_xact_lock(862198713);
   IF EXISTS(SELECT 1 FROM share_links s WHERE s.file_id=NEW.file_id AND s.id<>NEW.id AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>clock_timestamp())) THEN
     RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='A file can have only one active share link.', CONSTRAINT='share_links_one_active';
   END IF;
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER share_links_one_active BEFORE INSERT OR UPDATE OF file_id,expires_at,revoked_at ON share_links FOR EACH ROW EXECUTE FUNCTION vault_single_active_share();
