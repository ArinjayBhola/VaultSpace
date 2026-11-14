import { owner } from '@/lib/auth';
import { ownedFile } from '@/features/files/service';
import { id } from '@/lib/validation';
import { getObject } from '@/lib/storage';
import { respond } from '@/lib/api';
import { db } from '@/db';
import { files } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await owner();
    const file = await ownedFile(user.id, id.parse((await context.params).id));
    const url = new URL(request.url);
    const thumbnail = url.searchParams.get('thumbnail') === '1';
    const range = request.headers.get('range');
    if (range && !/^bytes=\d+-\d*$/.test(range))
      return new Response(null, { status: 416 });
    const object = await getObject(
      thumbnail && file.thumbnailKey ? file.thumbnailKey : file.r2ObjectKey,
      range ?? undefined,
    );
    if (
      !thumbnail &&
      (!file.lastAccessedAt ||
        file.lastAccessedAt.getTime() < Date.now() - 300000)
    )
      await db()
        .update(files)
        .set({ lastAccessedAt: new Date() })
        .where(
          and(
            eq(files.id, file.id),
            sql`(${files.lastAccessedAt} is null or ${files.lastAccessedAt}<now()-interval '5 minutes')`,
          ),
        );
    const headers = new Headers({
      'Content-Type':
        thumbnail && file.thumbnailKey ? 'image/webp' : file.mimeType,
      'Cache-Control': 'private, no-store',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `${url.searchParams.get('download') === '1' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.displayName)}`,
    });
    if (object.ContentLength !== undefined)
      headers.set('Content-Length', String(object.ContentLength));
    if (object.ContentRange) headers.set('Content-Range', object.ContentRange);
    if (!object.Body) throw new Error('Object body missing');
    return new Response(object.Body.transformToWebStream(), {
      status: object.ContentRange ? 206 : 200,
      headers,
    });
  } catch (e) {
    return respond(async () => {
      throw e;
    });
  }
}
