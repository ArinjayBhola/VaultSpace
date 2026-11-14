import { cookies } from 'next/headers';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { shareLinks } from '@/db/schema';
import { respond, originGuard, readJSON } from '@/lib/api';
import { ApiError } from '@/lib/auth';
import {
  resolveShare,
  throttleShare,
  grant,
  validGrant,
  checkSharePassword,
} from '@/lib/sharing';
import { getObject } from '@/lib/storage';
type Context = { params: Promise<{ token: string }> };
export async function POST(request: Request, context: Context) {
  return respond(async () => {
    originGuard(request);
    const { token } = await context.params;
    const row = await resolveShare(token);
    await throttleShare(row.share.id);
    const { password } = z
      .object({ password: z.string().max(128).default('') })
      .parse(await readJSON(request));
    if (
      row.share.passwordHash &&
      !checkSharePassword(password, row.share.passwordHash)
    )
      throw new ApiError(
        403,
        'WRONG_PASSWORD',
        'The share password is incorrect.',
      );
    (await cookies()).set(`share_${row.share.id}`, grant(row.share.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: `/api/public/${token}`,
      maxAge: 300,
    });
    await db()
      .update(shareLinks)
      .set({
        accessCount: sql`${shareLinks.accessCount}+1`,
        lastAccessedAt: new Date(),
      })
      .where(eq(shareLinks.id, row.share.id));
    return {
      name: row.file.displayName,
      mimeType: row.file.mimeType,
      size: row.file.sizeBytes,
      contentUrl: `/api/public/${token}`,
    };
  });
}
export async function GET(request: Request, context: Context) {
  try {
    const row = await resolveShare((await context.params).token);
    const value = (await cookies()).get(`share_${row.share.id}`)?.value;
    if (!validGrant(value, row.share.id))
      throw new ApiError(
        401,
        'GRANT_REQUIRED',
        'Open the share and authorize access again.',
      );
    const range = request.headers.get('range');
    if (range && !/^bytes=\d+-\d*$/.test(range))
      return new Response(null, { status: 416 });
    const object = await getObject(row.file.r2ObjectKey, range ?? undefined);
    if (!object.Body) throw new Error('File unavailable');
    const headers = new Headers({
      'Content-Type': row.file.mimeType,
      'Cache-Control': 'private, no-store',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.file.displayName)}`,
    });
    if (object.ContentRange) headers.set('Content-Range', object.ContentRange);
    if (object.ContentLength !== undefined)
      headers.set('Content-Length', String(object.ContentLength));
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
