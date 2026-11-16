import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { files } from '@/db/schema';
import { ownedFile } from '@/features/files/service';
import { owner } from '@/lib/auth';
import { respond } from '@/lib/api';
import { id } from '@/lib/validation';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return respond(async () => {
    const user = await owner();
    const file = await ownedFile(user.id, id.parse((await context.params).id));
    const [job] = await db()
      .select({
        error: sql<
          string | null
        >`(select last_error from processing_jobs where file_id=${file.id} and generation=${file.processingVersion} order by created_at desc limit 1)`,
        activeShareCount: sql<number>`(select count(*)::int from share_links where file_id=${file.id} and revoked_at is null and (expires_at is null or expires_at>now()))`,
      })
      .from(files)
      .where(eq(files.id, file.id));
    return {
      file: {
        id: file.id,
        activeShareCount: job?.activeShareCount ?? 0,
        folderId: file.folderId,
        folderProtected: file.folderProtected,
        lastAccessedAt: file.lastAccessedAt,
        displayName: file.displayName,
        originalFilename: file.originalFilename,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        deletedAt: file.deletedAt,
        starredAt: file.starredAt,
        processingStatus: file.processingStatus,
        description: file.description,
        pageCount: file.pageCount,
        width: file.width,
        height: file.height,
        hasThumbnail: Boolean(file.thumbnailKey),
        thumbnailVersion: file.processingVersion,
        relevance: 0,
      },
      processingError: job?.error ?? null,
    };
  });
}
