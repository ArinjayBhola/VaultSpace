import { folderScope, fileAccessSQL } from '@/lib/folder-access';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { activityEvents, files } from '@/db/schema';
import { owner } from '@/lib/auth';
import { respond, originGuard, readJSON } from '@/lib/api';

export async function GET(request: Request) {
  return respond(async () => {
    const user = await owner();
    const scope = await folderScope(user.id);
    const accessible = sql`(${activityEvents.fileId} is null or exists(select 1 from files where files.id=${activityEvents.fileId} and ${fileAccessSQL(scope.sessionId)}))`;
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(new URL(request.url).searchParams.get('page') || '1');
    const limit = 20;
    return db().transaction(async (tx) => {
      await tx.execute(
        sql`set transaction isolation level repeatable read, read only`,
      );
      const [total] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(activityEvents)
        .where(and(eq(activityEvents.ownerId, user.id), accessible));
      const pages = Math.max(1, Math.ceil(total.count / limit));
      const currentPage = Math.min(page, pages);
      const items = await tx
        .select({
          id: activityEvents.id,
          event: activityEvents.eventType,
          createdAt: activityEvents.createdAt,
          fileName: files.displayName,
        })
        .from(activityEvents)
        .leftJoin(
          files,
          and(eq(files.id, activityEvents.fileId), eq(files.ownerId, user.id)),
        )
        .where(and(eq(activityEvents.ownerId, user.id), accessible))
        .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
        .limit(limit)
        .offset((currentPage - 1) * limit);
      return {
        items,
        page: currentPage,
        total: total.count,
        pages,
      };
    });
  });
}

export async function POST(request: Request) {
  return respond(async () => {
    originGuard(request);
    const user = await owner();
    z.object({ action: z.literal('clear') })
      .strict()
      .parse(await readJSON(request));
    const result = await db().execute<{ deletedCount: number }>(sql`
      with removed as (
        delete from activity_events where owner_id=${user.id} returning 1
      ) select count(*)::int as "deletedCount" from removed
    `);
    return { success: true, deletedCount: result.rows[0].deletedCount };
  });
}
