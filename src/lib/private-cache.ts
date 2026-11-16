import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { FILE_CACHE_SECONDS } from './cache-policy';

type ContentIdentity = {
  id: string;
  r2ObjectKey: string;
  checksum: string | null;
  sizeBytes: number;
  mimeType: string;
  displayName: string;
  thumbnailKey: string | null;
  thumbnailBytes: number;
  processingVersion: number;
  processingStatus: string;
};

export function contentETag(file: ContentIdentity, thumbnail = false) {
  const identity =
    thumbnail && file.thumbnailKey
      ? [
          file.id,
          file.thumbnailKey,
          file.thumbnailBytes,
          file.processingVersion,
          file.processingStatus,
          file.displayName,
        ]
      : [
          file.id,
          file.r2ObjectKey,
          file.checksum,
          file.sizeBytes,
          file.mimeType,
          file.displayName,
        ];
  return (
    '"' +
    createHash('sha256').update(JSON.stringify(identity)).digest('hex') +
    '"'
  );
}

export function matchesETag(value: string | null, etag: string) {
  return Boolean(
    value
      ?.split(',')
      .some(
        (item) =>
          item.trim() === '*' || item.trim().replace(/^W\//, '') === etag,
      ),
  );
}

export function privateContentHeaders(etag: string, revalidate = false) {
  return new Headers({
    'Cache-Control': revalidate
      ? 'private, no-cache, must-revalidate'
      : `private, max-age=${FILE_CACHE_SECONDS}, must-revalidate`,
    ETag: etag,
    Vary: 'Cookie',
  });
}

export function invalidatePrivateBrowserCache(response: Response) {
  if (!response.ok) return response;
  const headers = new Headers(response.headers);
  headers.set('Clear-Site-Data', '"cache"');
  // Vary: Cookie isolates old responses even in browsers without Clear-Site-Data.
  headers.append(
    'Set-Cookie',
    `vault_cache_revision=${randomUUID()}; Path=/; Max-Age=604800; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
