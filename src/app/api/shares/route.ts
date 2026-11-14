import { vaultWriteLock } from '@/db/lock';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { shareLinks, shareViewers, files, activityEvents } from '@/db/schema';
import { owner, ApiError } from '@/lib/auth';
import { respond, originGuard, readJSON } from '@/lib/api';
import { id } from '@/lib/validation';
import { tokenHash, hashSharePassword } from '@/lib/sharing';
export async function GET(request: Request) {
  return respond(async () => {
    const user = await owner();
    const query = z
      .object({
        page: z.coerce.number().int().min(1).max(100000).default(1),
        status: z.enum(['all', 'active', 'expired', 'revoked']).default('all'),
        fileId: id.optional(),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    const where = and(
      eq(files.ownerId, user.id),
      query.fileId ? eq(shareLinks.fileId, query.fileId) : undefined,
      query.status === 'active'
        ? sql`${shareLinks.revokedAt} is null and (${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now()) and ${files.deletedAt} is null`
        : query.status === 'revoked'
          ? sql`${shareLinks.revokedAt} is not null`
          : query.status === 'expired'
            ? sql`${shareLinks.revokedAt} is null and ${shareLinks.expiresAt}<=now()`
            : undefined,
    );
    const [count] = await db()
      .select({ count: sql<number>`count(*)::int` })
      .from(shareLinks)
      .innerJoin(files, eq(files.id, shareLinks.fileId))
      .where(where);
    const items = await db()
      .select({
        id: shareLinks.id,
        fileId: shareLinks.fileId,
        filename: files.displayName,
        mimeType: files.mimeType,
        createdAt: shareLinks.createdAt,
        expiresAt: shareLinks.expiresAt,
        revokedAt: shareLinks.revokedAt,
        accessCount: shareLinks.accessCount,
        lastAccessedAt: shareLinks.lastAccessedAt,
        active: sql<boolean>`${shareLinks.revokedAt} is null and (${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now()) and ${files.deletedAt} is null`,
        activeViewers: sql<number>`case when ${shareLinks.revokedAt} is null and (${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now()) and ${files.deletedAt} is null then (select count(*)::int from share_viewers v where v.share_id=${shareLinks.id} and v.last_seen_at>now()-interval '45 seconds' and v.expires_at>now()) else 0 end`,
        protected: sql<boolean>`${shareLinks.passwordHash} is not null`,
      })
      .from(shareLinks)
      .innerJoin(files, eq(files.id, shareLinks.fileId))
      .where(where)
      .orderBy(desc(shareLinks.createdAt), desc(shareLinks.id))
      .limit(25)
      .offset((query.page - 1) * 25);
    const [totals] = await db()
      .select({
        views: sql<number>`coalesce(sum(${shareLinks.accessCount}),0)::int`,
        activeLinks: sql<number>`count(*) filter(where ${shareLinks.revokedAt} is null and (${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now()) and ${files.deletedAt} is null)::int`,
        activeViewers: sql<number>`coalesce(sum(case when ${shareLinks.revokedAt} is null and (${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now()) and ${files.deletedAt} is null then (select count(*) from share_viewers v where v.share_id=${shareLinks.id} and v.last_seen_at>now()-interval '45 seconds' and v.expires_at>now()) else 0 end),0)::int`,
      })
      .from(shareLinks)
      .innerJoin(files, eq(files.id, shareLinks.fileId))
      .where(where);
    return { items, totals, count: count.count, page: query.page, limit: 25 };
  });
}
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    fileId: id,
    expiresAt: z.iso.datetime().nullable(),
    password: z.string().min(8).max(128).nullable(),
  }),
  z.object({ action: z.literal('revoke'), id }),
  z.object({ action: z.literal('revoke-file'), fileId: id }),
]);
export async function POST(request: Request) {
  return respond(async () => {
    originGuard(request);
    const user = await owner();
    const input = schema.parse(await readJSON(request));
    if (input.action === 'revoke-file') {
      return db().transaction(async (tx) => {
        await tx.execute(vaultWriteLock);
        const [file] = await tx
          .select({ id: files.id })
          .from(files)
          .where(and(eq(files.id, input.fileId), eq(files.ownerId, user.id)));
        if (!file) throw new ApiError(404, 'NOT_FOUND', 'File not found.');
        const revoked = await tx
          .update(shareLinks)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(shareLinks.fileId, file.id),
              sql`${shareLinks.revokedAt} is null`,
            ),
          )
          .returning({ id: shareLinks.id });
        await tx
          .delete(shareViewers)
          .where(
            sql`${shareViewers.shareId} in (select id from share_links where file_id=${file.id})`,
          );
        if (revoked.length)
          await tx.insert(activityEvents).values({
            ownerId: user.id,
            fileId: file.id,
            eventType: 'share_revoked',
            metadata: { links: revoked.length },
          });
        return { success: true, count: revoked.length };
      });
    }
    if (input.action === 'create') {
      if (input.expiresAt && new Date(input.expiresAt) <= new Date())
        throw new ApiError(
          400,
          'INVALID_EXPIRY',
          'Choose an expiration in the future.',
        );
      const token = randomBytes(32).toString('hex');
      const passwordHash = input.password
        ? hashSharePassword(input.password)
        : null;
      await db().transaction(async (tx) => {
        await tx.execute(vaultWriteLock);
        const [file] = await tx
          .select({ id: files.id })
          .from(files)
          .where(
            and(
              eq(files.id, input.fileId),
              eq(files.ownerId, user.id),
              isNull(files.deletedAt),
              eq(files.uploadStatus, 'complete'),
            ),
          );
        if (!file) throw new ApiError(404, 'NOT_FOUND', 'File not found.');
        await tx.insert(shareLinks).values({
          fileId: file.id,
          tokenHash: tokenHash(token),
          passwordHash,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        });
        await tx.insert(activityEvents).values({
          ownerId: user.id,
          fileId: file.id,
          eventType: 'share_created',
        });
      });
      return { url: `${process.env.BETTER_AUTH_URL}/s/${token}` };
    }
    const [share] = await db()
      .select({ id: shareLinks.id, fileId: files.id })
      .from(shareLinks)
      .innerJoin(files, eq(files.id, shareLinks.fileId))
      .where(and(eq(shareLinks.id, input.id), eq(files.ownerId, user.id)));
    if (!share) throw new ApiError(404, 'NOT_FOUND', 'Share not found.');
    await db().transaction(async (tx) => {
      await tx.execute(vaultWriteLock);
      await tx
        .update(shareLinks)
        .set({ revokedAt: sql`coalesce(${shareLinks.revokedAt},now())` })
        .where(eq(shareLinks.id, share.id));
      await tx.delete(shareViewers).where(eq(shareViewers.shareId, share.id));
      await tx.insert(activityEvents).values({
        ownerId: user.id,
        fileId: share.fileId,
        eventType: 'share_revoked',
      });
    });
    return { success: true };
  });
}
