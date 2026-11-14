DROP INDEX IF EXISTS files_search_text;
--> statement-breakpoint
DROP TABLE "file_embeddings";--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "caption";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "ai_enabled";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "indexing_limit";
--> statement-breakpoint
CREATE INDEX files_search_text ON files USING gin (to_tsvector('english', display_name || ' ' || original_filename || ' ' || description || ' ' || extension || ' ' || mime_type));
--> statement-breakpoint
-- Retire only obsolete AI completion states; real processing failures are preserved.
UPDATE files SET processing_status = CASE
  WHEN mime_type='application/pdf' AND EXISTS (SELECT 1 FROM pdf_pages p WHERE p.file_id=files.id AND p.extraction_status='ocr_required') AND NOT EXISTS (SELECT 1 FROM pdf_pages p WHERE p.file_id=files.id AND length(trim(p.extracted_text))>0) THEN 'ocr_required'
  ELSE 'ready' END
WHERE processing_status IN ('indexed','ai_unconfigured','index_limit');
--> statement-breakpoint
UPDATE processing_jobs SET status='complete', last_error=null, completed_at=now(), updated_at=now()
WHERE status='blocked' AND job_type='process' AND last_error IN ('Indexing chunk limit exceeded. Increase the per-file limit in Settings and retry.','Cloud AI is enabled but server credentials are missing.');
--> statement-breakpoint
DELETE FROM rate_limits WHERE key LIKE 'ai-summary:%';
--> statement-breakpoint
-- No CASCADE: never remove another application's objects from a shared database.
DO $$ BEGIN
  DROP EXTENSION IF EXISTS vector;
EXCEPTION WHEN dependent_objects_still_exist THEN
  RAISE NOTICE 'vector extension retained because unrelated database objects still depend on it';
END $$;
