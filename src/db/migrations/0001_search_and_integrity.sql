CREATE INDEX files_name_trigram ON files USING gin (display_name gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX files_search_text ON files USING gin (to_tsvector('english', display_name || ' ' || original_filename || ' ' || description || ' ' || coalesce(caption, '') || ' ' || extension || ' ' || mime_type));
--> statement-breakpoint
CREATE INDEX pdf_pages_search ON pdf_pages USING gin (to_tsvector('english', extracted_text));
--> statement-breakpoint
CREATE INDEX shares_file ON share_links (file_id);
--> statement-breakpoint
CREATE INDEX bookmarks_file ON pdf_bookmarks (file_id);
--> statement-breakpoint
CREATE FUNCTION prevent_folder_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (
      WITH RECURSIVE ancestors AS (
        SELECT id,parent_id FROM folders WHERE id=NEW.parent_id
        UNION
        SELECT f.id,f.parent_id FROM folders f JOIN ancestors a ON f.id=a.parent_id
      ) SELECT 1 FROM ancestors WHERE id=NEW.id
    ) THEN RAISE EXCEPTION 'Folder cycle prohibited' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER folder_cycle_guard BEFORE INSERT OR UPDATE OF parent_id ON folders FOR EACH ROW EXECUTE FUNCTION prevent_folder_cycle();
