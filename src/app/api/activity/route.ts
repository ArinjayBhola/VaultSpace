import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { activityEvents, files } from '@/db/schema';
import { owner } from '@/lib/auth';
import { respond } from '@/lib/api';

export async function GET(request: Request) {
  return respond(async () => {
    const user = await owner();
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
        .where(eq(activityEvents.ownerId, user.id));
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
        .where(eq(activityEvents.ownerId, user.id))
        .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
        .limit(limit)
        .offset((page - 1) * limit);
      return {
        items,
        page,
        total: total.count,
        pages: Math.max(1, Math.ceil(total.count / limit)),
      };
    });
  });
}
