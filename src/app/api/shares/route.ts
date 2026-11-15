import { vaultWriteLock } from '@/db/lock';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { shareLinks, shareViewers, files, activityEvents } from '@/db/schema';
import { owner, ApiError } from '@/lib/auth';
import { respond, originGuard, readJSON } from '@/lib/api';
import { id } from '@/lib/validation';
import {
  tokenHash,
  hashSharePassword,
  shareToken,
  ownerShareUrl,
} from '@/lib/sharing';
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
    const active = sql`${shareLinks.revokedAt} is null and (${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now()) and ${files.deletedAt} is null`;
    const endedAt = sql`least(${shareLinks.revokedAt},${shareLinks.expiresAt},${files.deletedAt})`;
    const where = and(
      eq(files.ownerId, user.id),
      sql`((${active}) or ${endedAt}>now()-interval '24 hours')`,
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
        tokenHash: shareLinks.tokenHash,
        endedAt: sql<
          string | null
        >`case when ${active} then null else ${endedAt} end`,
        visibleUntil: sql<
          string | null
        >`case when ${active} then null else ${endedAt}+interval '24 hours' end`,
        fileId: shareLinks.fileId,
        filename: files.displayName,
        mimeType: files.mimeType,
        createdAt: shareLinks.createdAt,
        expiresAt: shareLinks.expiresAt,
        revokedAt: shareLinks.revokedAt,
        accessCount: shareLinks.accessCount,
        lastAccessedAt: shareLinks.lastAccessedAt,
        active: sql<boolean>`${shareLinks.revokedAt} is null and (${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now()) and ${files.deletedAt} is null`,
        activeViewers: sql<number>`case when ${shareLinks.revokedAt} is null and (${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now()) and ${files.deletedAt} is null then (select count(*)::int from share_viewers v where v.share_id=${shareLinks.id} and v.last_seen_at>now()-interval '90 seconds' and v.expires_at>now()) else 0 end`,
        protected: sql<boolean>`${shareLinks.passwordHash} is not null`,
      })
      .from(shareLinks)
      .innerJoin(files, eq(files.id, shareLinks.fileId))
      .where(where)
      .orderBy(
        desc(sql`case when ${active} then 1 else 0 end`),
        desc(sql`coalesce(${endedAt},${shareLinks.createdAt})`),
        desc(shareLinks.id),
      )
      .limit(25)
      .offset((query.page - 1) * 25);
    const [totals] = await db()
      .select({
        views: sql<number>`coalesce(sum(${shareLinks.accessCount}),0)::int`,
        activeLinks: sql<number>`count(*) filter(where ${shareLinks.revokedAt} is null and (${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now()) and ${files.deletedAt} is null)::int`,
        activeViewers: sql<number>`coalesce(sum(case when ${shareLinks.revokedAt} is null and (${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now()) and ${files.deletedAt} is null then (select count(*) from share_viewers v where v.share_id=${shareLinks.id} and v.last_seen_at>now()-interval '90 seconds' and v.expires_at>now()) else 0 end),0)::int`,
      })
      .from(shareLinks)
      .innerJoin(files, eq(files.id, shareLinks.fileId))
      .where(where);
    return {
      items: items.map(({ tokenHash: storedHash, ...item }) => ({
        ...item,
        url: ownerShareUrl(item.id, storedHash),
      })),
      totals,
      count: count.count,
      page: query.page,
      limit: 25,
    };
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
              sql`${shareLinks.revokedAt} is null and (${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now())`,
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
      const shareId = randomUUID();
      const token = shareToken(shareId);
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
        const [existing] = await tx
          .select({ id: shareLinks.id })
          .from(shareLinks)
          .where(
            and(
              eq(shareLinks.fileId, file.id),
              isNull(shareLinks.revokedAt),
              sql`(${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now())`,
            ),
          )
          .limit(1);
        if (existing)
          throw new ApiError(
            409,
            'SHARE_EXISTS',
            'This file already has an active link. Copy or revoke it before creating another.',
          );
        await tx.insert(shareLinks).values({
          id: shareId,
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
      return { url: new URL('/s/' + token, process.env.BETTER_AUTH_URL).href };
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
        .where(
          and(
            eq(shareLinks.id, share.id),
            isNull(shareLinks.revokedAt),
            sql`(${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now())`,
          ),
        );
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
