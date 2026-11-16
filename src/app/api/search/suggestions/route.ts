import { folderScope, fileAccessSQL } from '@/lib/folder-access';
import { and, eq, isNull, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { files } from '@/db/schema';
import { owner } from '@/lib/auth';
import { respond } from '@/lib/api';
export async function GET(request: Request) {
  return respond(async () => {
    const user = await owner();
    const scope = await folderScope(user.id);
    const q = z
      .string()
      .trim()
      .min(2)
      .max(500)
      .parse(new URL(request.url).searchParams.get('q') ?? '');
    const pattern = '%' + q.replace(/[%_\\]/g, '\\$&') + '%';
    const matches = await db()
      .select({
        id: files.id,
        displayName: files.displayName,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
      })
      .from(files)
      .where(
        and(
          eq(files.ownerId, user.id),
          fileAccessSQL(scope.sessionId),
          eq(files.uploadStatus, 'complete'),
          isNull(files.deletedAt),
          sql`(${files.displayName} ilike ${pattern} or ${files.originalFilename} ilike ${pattern} or ${files.extension} ilike ${pattern} or ${files.mimeType} ilike ${pattern})`,
        ),
      )
      .orderBy(desc(files.createdAt), desc(files.id))
      .limit(5);
    return { files: matches };
  });
}
