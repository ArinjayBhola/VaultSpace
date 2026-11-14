import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '@/db';
import { files, activityEvents, settings } from '@/db/schema';
import { owner } from '@/lib/auth';
import { respond } from '@/lib/api';
import { z } from 'zod';
export async function GET(request: Request) {
  return respond(async () => {
    const user = await owner();
    const timeZone = z
      .string()
      .min(1)
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Choose a valid timezone.')
      .parse(
        new URL(request.url).searchParams.get('timezone') || 'Asia/Kolkata',
      );
    const [totals, distribution, timeline, largest, activity] =
      await Promise.all([
        db()
          .select({
            totalFiles: sql<number>`count(*) filter(where deleted_at is null)::int`,
            images: sql<number>`count(*) filter(where deleted_at is null and mime_type like 'image/%')::int`,
            pdfs: sql<number>`count(*) filter(where deleted_at is null and mime_type='application/pdf')::int`,
            activeBytes: sql<number>`coalesce(sum(size_bytes) filter(where deleted_at is null),0)::float8`,
            trashedBytes: sql<number>`coalesce(sum(size_bytes) filter(where deleted_at is not null),0)::float8`,
            derivedBytes: sql<number>`coalesce(sum(thumbnail_bytes),0)::float8`,
            trashedFiles: sql<number>`count(*) filter(where deleted_at is not null)::int`,
            thisMonth: sql<number>`count(*) filter(where deleted_at is null and created_at>=(date_trunc('month',now() at time zone ${timeZone}) at time zone ${timeZone}))::int`,
          })
          .from(files)
          .where(
            and(eq(files.ownerId, user.id), eq(files.uploadStatus, 'complete')),
          ),
        db()
          .select({
            type: files.mimeType,
            count: sql<number>`count(*)::int`,
            bytes: sql<number>`sum(size_bytes)::float8`,
          })
          .from(files)
          .where(
            sql`${files.ownerId}=${user.id} and ${files.deletedAt} is null and ${files.uploadStatus}='complete'`,
          )
          .groupBy(files.mimeType),
        db().execute<{ day: string; count: number; bytes: number }>(
          sql`select d::date::text as day,count(f.id)::int as count,coalesce(sum(f.size_bytes),0)::float8 as bytes from generate_series(((now() at time zone ${timeZone})::date-29)::timestamp,((now() at time zone ${timeZone})::date)::timestamp,interval '1 day') d left join files f on (f.created_at at time zone ${timeZone})::date=d::date and f.owner_id=${user.id} and f.upload_status='complete' group by d order by d`,
        ),
        db()
          .select({
            id: files.id,
            name: files.displayName,
            size: files.sizeBytes,
            mimeType: files.mimeType,
          })
          .from(files)
          .where(
            sql`${files.ownerId}=${user.id} and ${files.deletedAt} is null and ${files.uploadStatus}='complete'`,
          )
          .orderBy(desc(files.sizeBytes))
          .limit(5),
        db()
          .select({
            id: activityEvents.id,
            event: activityEvents.eventType,
            createdAt: activityEvents.createdAt,
          })
          .from(activityEvents)
          .where(eq(activityEvents.ownerId, user.id))
          .orderBy(desc(activityEvents.createdAt))
          .limit(8),
      ]);
    const [preferences] = await db()
      .select()
      .from(settings)
      .where(eq(settings.ownerId, user.id));
    return {
      timeZone,
      warningReached: preferences?.warningBytes
        ? totals[0].activeBytes +
            totals[0].trashedBytes +
            totals[0].derivedBytes >=
          preferences.warningBytes
        : false,
      ...totals[0],
      distribution,
      timeline: timeline.rows,
      largest,
      activity,
      updatedAt: new Date().toISOString(),
      storageLabel:
        'Logical file storage. Excludes incomplete transfers and R2 billing overhead.',
    };
  });
}
