import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { processingJobs } from '@/db/schema';
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
      .select({ error: processingJobs.lastError })
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.fileId, file.id),
          eq(processingJobs.generation, file.processingVersion),
        ),
      )
      .orderBy(desc(processingJobs.createdAt))
      .limit(1);
    return {
      file: {
        id: file.id,
        folderId: file.folderId,
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
        relevance: 0,
      },
      processingError: job?.error ?? null,
    };
  });
}
