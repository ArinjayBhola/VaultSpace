import 'server-only';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { files } from '@/db/schema';
import {
  galleryImageExtensions,
  galleryVideoFallbackExtensions,
  rasterTypes,
} from '@/lib/file-types';

// Keep gallery counts, page contents and format facets on the same media scope.
export function galleryMediaSQL() {
  return or(
    and(
      inArray(files.extension, galleryImageExtensions),
      inArray(files.mimeType, rasterTypes),
    ),
    sql`${files.mimeType} like 'video/%'`,
    and(
      eq(files.mimeType, 'application/octet-stream'),
      inArray(files.extension, galleryVideoFallbackExtensions),
    ),
  )!;
}
