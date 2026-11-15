import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { shareLinks, files, rateLimit } from '@/db/schema';
import { ApiError } from './auth';
import { shareValid } from './validation';
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export function hashSharePassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function checkSharePassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  return timingSafeEqual(
    Buffer.from(hash, 'hex'),
    scryptSync(password, salt, 64),
  );
}
export async function resolveShare(token: string) {
  const alias =
    /^v1\.([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.([a-f0-9]{64})$/.exec(
      token,
    );
  const aliasId = alias?.[1];
  const aliasSignature = alias?.[2];
  if (!/^[a-f0-9]{64}$/.test(token) && (!aliasId || !aliasSignature))
    throw new ApiError(404, 'NOT_FOUND', 'This share is unavailable.');
  const [row] = await db()
    .select({ share: shareLinks, file: files })
    .from(shareLinks)
    .innerJoin(files, eq(files.id, shareLinks.fileId))
    .where(
      aliasId
        ? eq(shareLinks.id, aliasId)
        : eq(shareLinks.tokenHash, tokenHash(token)),
    );
  if (
    !row ||
    (aliasId &&
      (!aliasSignature ||
        !timingSafeEqual(
          Buffer.from(aliasSignature, 'hex'),
          Buffer.from(
            aliasSignatureFor(row.share.id, row.share.tokenHash),
            'hex',
          ),
        ))) ||
    !shareValid(row.share.expiresAt, row.share.revokedAt) ||
    row.file.deletedAt ||
    row.file.uploadStatus !== 'complete'
  )
    throw new ApiError(
      404,
      'NOT_FOUND',
      'This share has expired, was revoked, or is unavailable.',
    );
  return row;
}
function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value || value.length < 32)
    throw new Error('Share grant secret is missing.');
  return value;
}
export function grant(shareId: string) {
  const expiry = Date.now() + 5 * 60000;
  const data = `${shareId}.${expiry}`;
  return `${data}.${createHmac('sha256', secret()).update(data).digest('hex')}`;
}
export function validGrant(value: string | undefined, shareId: string) {
  if (!value) return false;
  const [id, expiry, signature] = value.split('.');
  if (
    id !== shareId ||
    !expiry ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    Number(expiry) < Date.now()
  )
    return false;
  const expected = createHmac('sha256', secret())
    .update(`${id}.${expiry}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
export async function throttleShare(shareId: string) {
  // One global budget per share avoids trusting spoofable IP headers on public deployments.
  const window = Math.floor(Date.now() / 60000);
  const key = `share:${shareId}:${window}`;
  const [row] = await db()
    .insert(rateLimit)
    .values({ id: key, key, count: 1, lastRequest: Date.now() })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: { count: sql`${rateLimit.count}+1` },
    })
    .returning();
  if (row.count > 20)
    throw new ApiError(
      429,
      'RATE_LIMITED',
      'Too many attempts. Try again in a minute.',
    );
}

// URLs can be recovered for the owner without plaintext token storage.
// A signed alias is bound to the same share ID and token hash: it shares the
// original password, expiry, revocation, throttle and access counters.
export function shareToken(shareId: string) {
  return createHmac('sha256', secret())
    .update('vaultspace/share-url/v1:' + shareId)
    .digest('hex');
}
function aliasSignatureFor(shareId: string, storedHash: string) {
  return createHmac('sha256', secret())
    .update('vaultspace/share-alias/v1:' + shareId + ':' + storedHash)
    .digest('hex');
}
export function ownerShareUrl(shareId: string, storedHash: string) {
  if (!/^[a-f0-9]{64}$/.test(storedHash)) return null;
  const token = shareToken(shareId);
  const originalAvailable = timingSafeEqual(
    Buffer.from(tokenHash(token), 'hex'),
    Buffer.from(storedHash, 'hex'),
  );
  const publicToken = originalAvailable
    ? token
    : 'v1.' + shareId + '.' + aliasSignatureFor(shareId, storedHash);
  return new URL('/s/' + publicToken, process.env.BETTER_AUTH_URL).href;
}
