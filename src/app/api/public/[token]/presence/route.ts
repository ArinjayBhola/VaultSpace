import { cookies } from 'next/headers';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { shareViewers, rateLimit, shareLinks } from '@/db/schema';
import { respond, originGuard, readJSON } from '@/lib/api';
import { ApiError } from '@/lib/auth';
import {
  resolveShare,
  tokenHash,
  validGrant,
  grant as createGrant,
} from '@/lib/sharing';
export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  return respond(async () => {
    originGuard(request);
    const input = z
      .object({ viewerId: z.uuid(), active: z.boolean() })
      .parse(await readJSON(request));
    const token = (await context.params).token;
    const row = await resolveShare(token);
    const grant = (await cookies()).get(`share_${row.share.id}`)?.value;
    if (!validGrant(grant, row.share.id))
      throw new ApiError(
        401,
        'GRANT_REQUIRED',
        'Your viewing session ended. Open the shared file again.',
      );
    const viewerHash = tokenHash(input.viewerId);
    const key = `share-presence:${row.share.id}:${Math.floor(Date.now() / 60000)}`;
    const [budget] = await db()
      .insert(rateLimit)
      .values({ id: key, key, count: 1, lastRequest: Date.now() })
      .onConflictDoUpdate({
        target: rateLimit.key,
        set: { count: sql`${rateLimit.count}+1` },
      })
      .returning({ count: rateLimit.count });
    if (budget.count > 240)
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'Viewer updates are temporarily limited.',
      );
    if (!input.active) {
      await db()
        .delete(shareViewers)
        .where(
          and(
            eq(shareViewers.shareId, row.share.id),
            eq(shareViewers.viewerHash, viewerHash),
          ),
        );
      return { active: false };
    }
    const expiry = Date.now() + 5 * 60000;
    const expiresAt = new Date(
      Math.min(expiry, row.share.expiresAt?.getTime() ?? expiry),
    );
    await db().transaction(async (tx) => {
      const [current] = await tx
        .select({ id: shareLinks.id })
        .from(shareLinks)
        .where(
          and(
            eq(shareLinks.id, row.share.id),
            sql`${shareLinks.revokedAt} is null and (${shareLinks.expiresAt} is null or ${shareLinks.expiresAt}>now())`,
          ),
        )
        .for('share');
      if (!current)
        throw new ApiError(
          404,
          'SHARE_UNAVAILABLE',
          'This share is no longer available.',
        );
      await tx
        .insert(shareViewers)
        .values({
          shareId: row.share.id,
          viewerHash,
          expiresAt,
          lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [shareViewers.shareId, shareViewers.viewerHash],
          set: { lastSeenAt: new Date(), expiresAt },
        });
    });
    (await cookies()).set(`share_${row.share.id}`, createGrant(row.share.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: `/api/public/${token}`,
      maxAge: 300,
    });
    return { active: true };
  });
}
