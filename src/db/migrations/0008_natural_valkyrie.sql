DROP TABLE "pdf_pages" CASCADE;--> statement-breakpoint
ALTER TABLE "processing_jobs" DROP COLUMN "next_page";
--> statement-breakpoint
DROP INDEX IF EXISTS files_search_text;
--> statement-breakpoint
UPDATE files SET processing_status = CASE WHEN thumbnail_key IS NOT NULL THEN 'ready' ELSE 'failed' END WHERE processing_status = 'ocr_required';
--> statement-breakpoint
UPDATE processing_jobs j SET status = CASE WHEN f.thumbnail_key IS NOT NULL THEN 'complete' ELSE 'failed' END, last_error = CASE WHEN f.thumbnail_key IS NOT NULL THEN NULL ELSE 'Thumbnail unavailable. Retry thumbnail generation from file details.' END, updated_at = now() FROM files f WHERE j.file_id = f.id AND j.generation = f.processing_version AND j.status = 'blocked' AND j.last_error LIKE '%OCR%';
