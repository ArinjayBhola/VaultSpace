import { and, eq, sql } from 'drizzle-orm';
import { verifyPassword } from 'better-auth/crypto';
import { z } from 'zod';
import { db } from '@/db';
import { folders, folderUnlocks, rateLimit } from '@/db/schema';
import { vaultWriteLock } from '@/db/lock';
import { owner, ApiError } from '@/lib/auth';
import { respond, originGuard, readJSON } from '@/lib/api';
import { folderScope, assertFolderAccess } from '@/lib/folder-access';
import { id } from '@/lib/validation';
import { invalidatePrivateBrowserCache } from '@/lib/private-cache';
const inputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('unlock'),
    password: z.string().min(1).max(128),
  }),
  z.object({ action: z.literal('lock') }),
]);
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const response = await respond(async () => {
    originGuard(request);
    const user = await owner();
    const folderId = id.parse((await context.params).id);
    const input = inputSchema.parse(await readJSON(request));
    const scope = await folderScope(user.id);
    const [folder] = await db()
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.ownerId, user.id)));
    if (!folder) throw new ApiError(404, 'NOT_FOUND', 'Folder not found.');
    if (input.action === 'lock') {
      await db().transaction(async (tx) => {
        await tx.execute(vaultWriteLock);
        await tx.execute(
          sql`with recursive tree as(select id from folders where id=${folderId} union all select f.id from folders f join tree t on f.parent_id=t.id) delete from folder_unlocks where session_id=${scope.sessionId} and folder_id in(select id from tree)`,
        );
      });
      return { success: true };
    }
    await assertFolderAccess(user.id, folder.parentId);
    if (!folder.passwordHash)
      throw new ApiError(
        409,
        'NOT_PROTECTED',
        'This folder does not require a password.',
      );
    const key = 'folder:' + folderId + ':' + Math.floor(Date.now() / 60000);
    const [budget] = await db()
      .insert(rateLimit)
      .values({ id: key, key, count: 1, lastRequest: Date.now() })
      .onConflictDoUpdate({
        target: rateLimit.key,
        set: { count: sql`${rateLimit.count}+1` },
      })
      .returning({ count: rateLimit.count });
    if (budget.count > 5)
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'Too many attempts. Try again in a minute.',
      );
    if (
      !(await verifyPassword({
        hash: folder.passwordHash,
        password: input.password,
      }))
    )
      throw new ApiError(403, 'WRONG_PASSWORD', 'Incorrect folder password.');
    const expiresAt = new Date(
      Math.min(Date.now() + 30 * 60000, scope.expiresAt.getTime()),
    );
    await db()
      .insert(folderUnlocks)
      .values({ folderId, sessionId: scope.sessionId, expiresAt })
      .onConflictDoUpdate({
        target: [folderUnlocks.folderId, folderUnlocks.sessionId],
        set: { expiresAt },
      });
    return { success: true, expiresAt };
  });
  return invalidatePrivateBrowserCache(response);
}
