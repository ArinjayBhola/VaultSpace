import { and, eq, isNull } from 'drizzle-orm';
import sharp from 'sharp';
import { z } from 'zod';
import { db } from '@/db';
import { files } from '@/db/schema';
import { vaultWriteLock } from '@/db/lock';
import { owner, ApiError } from '@/lib/auth';
import { originGuard, respond } from '@/lib/api';
import { ownedFile } from '@/features/files/service';
import { assertFolderAccess } from '@/lib/folder-access';
import { isGalleryVideo } from '@/lib/file-types';
import { id } from '@/lib/validation';
import { putObject } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 30;
const dimensions = z.object({
  width: z.coerce.number().int().min(1).max(32768),
  height: z.coerce.number().int().min(1).max(32768),
});
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return respond(async () => {
    originGuard(request);
    const user = await owner();
    const fileId = id.parse((await context.params).id);
    const file = await ownedFile(user.id, fileId);
    if (!isGalleryVideo(file.originalFilename, file.mimeType))
      throw new ApiError(
        400,
        'NOT_VIDEO',
        'Only videos accept captured thumbnails.',
      );
    const size = dimensions.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (request.headers.get('content-type')?.split(';')[0] !== 'image/jpeg')
      throw new ApiError(415, 'JPEG_REQUIRED', 'Send a JPEG video frame.');
    const reader = request.body?.getReader();
    if (!reader)
      throw new ApiError(
        400,
        'BODY_REQUIRED',
        'A captured video frame is required.',
      );
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.length;
        if (length > 1024 * 1024) {
          await reader.cancel();
          throw new ApiError(
            413,
            'THUMBNAIL_TOO_LARGE',
            'The captured frame exceeds 1 MiB.',
          );
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const input = Buffer.concat(chunks);
    if (input[0] !== 0xff || input[1] !== 0xd8 || input[2] !== 0xff)
      throw new ApiError(
        400,
        'INVALID_FRAME',
        'The captured frame is not a JPEG.',
      );
    let thumbnail: Buffer;
    try {
      thumbnail = await sharp(input, { limitInputPixels: 1280 * 1280 })
        .rotate()
        .resize(640, 480, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
    } catch {
      throw new ApiError(
        400,
        'INVALID_FRAME',
        'The captured frame could not be decoded.',
      );
    }
    return db().transaction(async (tx) => {
      await tx.execute(vaultWriteLock);
      const [current] = await tx
        .select()
        .from(files)
        .where(
          and(
            eq(files.id, fileId),
            eq(files.ownerId, user.id),
            eq(files.uploadStatus, 'complete'),
            isNull(files.deletedAt),
          ),
        )
        .for('update');
      if (!current || current.processingStatus === 'deleting')
        throw new ApiError(404, 'NOT_FOUND', 'Video is no longer available.');
      await assertFolderAccess(user.id, current.folderId);
      if (current.thumbnailKey) return { success: true, created: false };
      const key = `derived/${fileId}/thumbnail.webp`;
      await putObject(key, thumbnail, 'image/webp');
      await assertFolderAccess(user.id, current.folderId);
      await tx
        .update(files)
        .set({
          thumbnailKey: key,
          thumbnailBytes: thumbnail.length,
          width: size.width,
          height: size.height,
          processingVersion: current.processingVersion + 1,
          processingStatus: 'ready',
          updatedAt: new Date(),
        })
        .where(eq(files.id, fileId));
      return { success: true, created: true };
    });
  });
}
