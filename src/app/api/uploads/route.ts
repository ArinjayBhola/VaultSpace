import {
  folderScope,
  fileAccessSQL,
  assertFolderAccess,
} from '@/lib/folder-access';
import { vaultWriteLock } from '@/db/lock';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { and, eq, sql, inArray } from 'drizzle-orm';
import { verifiedMime } from '@/lib/file-verification';
import { uploadMime, extensionOf, needsThumbnail } from '@/lib/file-types';
import { db } from '@/db';
import {
  files,
  uploads,
  settings,
  processingJobs,
  activityEvents,
} from '@/db/schema';
import { owner, ApiError } from '@/lib/auth';
import { respond, originGuard, readJSON } from '@/lib/api';
import { id, name, validFile, canTransition } from '@/lib/validation';
import { checkFolder } from '@/features/files/service';
import * as storage from '@/lib/storage';
const PART_SIZE = 16 * 1024 * 1024;
export const maxDuration = 300;
export async function GET(request: Request) {
  return respond(async () => {
    const user = await owner();
    const scope = await folderScope(user.id);
    if (!new URL(request.url).searchParams.has('ids')) {
      const [preferences] = await db()
        .select()
        .from(settings)
        .where(eq(settings.ownerId, user.id));
      return {
        maxBytes: Math.min(
          Number(process.env.MAX_UPLOAD_BYTES || 1073741824),
          5 * 1024 ** 3,
          preferences?.maxUploadBytes ?? Infinity,
        ),
      };
    }
    const ids = z
      .array(id)
      .min(1)
      .max(100)
      .parse(new URL(request.url).searchParams.get('ids')?.split(','));
    return db()
      .select({
        id: files.id,
        status: files.processingStatus,
        deleted: files.deletedAt,
      })
      .from(files)
      .where(
        and(
          eq(files.ownerId, user.id),
          inArray(files.id, ids),
          eq(files.uploadStatus, 'complete'),
          fileAccessSQL(scope.sessionId),
        ),
      );
  });
}
const inputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name,
    mime: z.string().max(100),
    size: z.number().int().positive(),
    folderId: id.nullable().default(null),
    checksum: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .default(null),
    duplicatePolicy: z.enum(['ask', 'keep']).default('ask'),
  }),
  z.object({
    action: z.literal('part'),
    id,
    part: z.number().int().min(1).max(10000),
  }),
  z.object({ action: z.literal('complete'), id }),
  z.object({ action: z.literal('cancel'), id }),
  z.object({ action: z.literal('retry-url'), id }),
]);
export async function POST(request: Request) {
  return respond(async () => {
    originGuard(request);
    const user = await owner();
    const scope = await folderScope(user.id);
    const input = inputSchema.parse(await readJSON(request));
    if (input.action === 'create') {
      input.mime = uploadMime(input.name, input.mime);
      storage.r2();
      const hardLimit = Math.min(
        Number(process.env.MAX_UPLOAD_BYTES || 1073741824),
        5 * 1024 ** 3,
      );
      const [prefs] = await db()
        .select()
        .from(settings)
        .where(eq(settings.ownerId, user.id));
      if (
        !validFile(
          input.name,
          input.mime,
          input.size,
          Math.min(prefs?.maxUploadBytes || hardLimit, hardLimit),
        )
      )
        throw new ApiError(
          400,
          'INVALID_FILE',
          'Choose a file within your upload size policy.',
        );
      await checkFolder(user.id, input.folderId);
      if (input.checksum && input.duplicatePolicy === 'ask') {
        const duplicate = await db()
          .select({ id: files.id, name: files.displayName })
          .from(files)
          .where(
            and(
              eq(files.ownerId, user.id),
              eq(files.checksum, input.checksum),
              eq(files.uploadStatus, 'complete'),
              fileAccessSQL(scope.sessionId),
            ),
          )
          .limit(1);
        if (duplicate.length) return { duplicate: duplicate[0] };
      }
      const fileId = randomUUID();
      const uploadId = randomUUID();
      const key = `staging/${uploadId}`;
      const multipart = input.size >= 32 * 1024 * 1024;

      await db().transaction(async (tx) => {
        await tx.execute(vaultWriteLock);
        if (prefs?.storageQuotaBytes) {
          const [usage] = await tx
            .select({ total: sql<number>`coalesce(sum(size_bytes),0)::float8` })
            .from(files)
            .where(
              and(
                eq(files.ownerId, user.id),
                sql`${files.uploadStatus} != 'cancelled'`,
              ),
            );
          if (usage.total + input.size > prefs.storageQuotaBytes)
            throw new ApiError(
              413,
              'QUOTA_EXCEEDED',
              'Your configured storage quota would be exceeded.',
            );
        }
        await tx.insert(files).values({
          id: fileId,
          ownerId: user.id,
          folderId: input.folderId,
          displayName: input.name,
          originalFilename: input.name,
          mimeType: input.mime,
          extension: extensionOf(input.name),
          sizeBytes: input.size,
          r2ObjectKey: `originals/${fileId}`,
          checksum: input.checksum,
        });
        await tx.insert(uploads).values({
          id: uploadId,
          ownerId: user.id,
          fileId,
          targetFolderId: input.folderId,
          objectKey: key,
          expectedSize: input.size,
          expectedMimeType: input.mime,
          checksum: input.checksum,
          expiresAt: new Date(Date.now() + 24 * 3600000),
        });
      });
      if (multipart) {
        const session = await storage.createMultipart(key, input.mime);
        if (!session.UploadId)
          throw new Error('R2 did not return a multipart session.');
        try {
          await db()
            .update(uploads)
            .set({ uploadSessionId: session.UploadId })
            .where(eq(uploads.id, uploadId));
        } catch (error) {
          try {
            await storage.abortMultipart(key, session.UploadId);
          } catch {
            console.error('multipart_abort_deferred_to_bucket_lifecycle');
          }
          throw error;
        }
      }
      return {
        id: uploadId,
        fileId,
        multipart,
        partSize: PART_SIZE,
        url: multipart
          ? null
          : await storage.signPut(key, input.mime, input.size),
      };
    }
    const [upload] = await db()
      .select()
      .from(uploads)
      .where(and(eq(uploads.id, input.id), eq(uploads.ownerId, user.id)));
    if (!upload)
      throw new ApiError(404, 'UPLOAD_NOT_FOUND', 'Upload session not found.');
    if (input.action !== 'cancel')
      await assertFolderAccess(user.id, upload.targetFolderId);
    if (upload.status === 'complete' && input.action === 'complete') {
      const [file] = await db()
        .select({ processingStatus: files.processingStatus })
        .from(files)
        .where(and(eq(files.id, upload.fileId), eq(files.ownerId, user.id)));
      if (!file) throw new ApiError(404, 'NOT_FOUND', 'File not found.');
      return {
        success: true,
        fileId: upload.fileId,
        processingStatus: file.processingStatus,
      };
    }
    if (upload.status === 'cancelled')
      if (input.action === 'cancel') return { success: true };
      else
        throw new ApiError(409, 'CANCELLED', 'This upload has been cancelled.');
    if (upload.status === 'complete')
      throw new ApiError(409, 'COMPLETE', 'This upload is already complete.');
    if (input.action === 'cancel') {
      if (!canTransition(upload.status, 'cancelled'))
        throw new ApiError(
          409,
          'VERIFYING',
          'Verification has started. Wait for the accepted file before moving it to trash.',
        );
      const changed = await db()
        .update(uploads)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(uploads.id, upload.id), eq(uploads.status, 'pending')))
        .returning();
      if (!changed.length)
        throw new ApiError(
          409,
          'VERIFYING',
          'Verification has started. Refresh the file list before deleting this file.',
        );
      await db()
        .update(files)
        .set({ uploadStatus: 'cancelled' })
        .where(eq(files.id, upload.fileId));
      if (upload.uploadSessionId)
        try {
          await storage.abortMultipart(
            upload.objectKey,
            upload.uploadSessionId,
          );
        } catch (error) {
          if (!(error instanceof Error) || error.name !== 'NoSuchUpload')
            throw error;
        }
      await storage.deleteObject(upload.objectKey);
      return { success: true };
    }
    if (upload.expiresAt < new Date())
      throw new ApiError(
        410,
        'EXPIRED',
        'Upload session expired. Start a new upload.',
      );
    if (input.action === 'part') {
      if (
        !upload.uploadSessionId ||
        input.part > Math.ceil(upload.expectedSize / PART_SIZE)
      )
        throw new ApiError(400, 'INVALID_PART', 'Invalid upload part.');
      return {
        url: await storage.signPart(
          upload.objectKey,
          upload.uploadSessionId,
          input.part,
        ),
      };
    }
    if (input.action === 'retry-url')
      return {
        url: await storage.signPut(
          upload.objectKey,
          upload.expectedMimeType,
          upload.expectedSize,
        ),
      };
    if (
      upload.status !== 'verifying' &&
      !canTransition(upload.status, 'verifying')
    )
      throw new ApiError(
        409,
        'INVALID_UPLOAD_STATE',
        'This upload cannot be finalized in its current state.',
      );
    const claimed = await db()
      .update(uploads)
      .set({ status: 'verifying', updatedAt: new Date() })
      .where(
        and(
          eq(uploads.id, upload.id),
          sql`(${uploads.status}='pending' or (${uploads.status}='verifying' and ${uploads.updatedAt}<now()-interval '5 minutes'))`,
        ),
      )
      .returning();
    if (!claimed.length)
      throw new ApiError(
        409,
        'VERIFYING',
        'Upload verification is already running. Retry shortly.',
      );
    try {
      if (upload.uploadSessionId) {
        // A retry after successful multipart completion has no multipart session; the object is authoritative.
        let exists = false;
        try {
          await storage.headObject(upload.objectKey);
          exists = true;
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !['NotFound', 'NoSuchKey'].includes(error.name)
          )
            throw error;
        }
        if (!exists) {
          const listed = await storage.listParts(
            upload.objectKey,
            upload.uploadSessionId,
          );
          const parts = (listed.Parts ?? []).map((part) => ({
            ETag: part.ETag!,
            PartNumber: part.PartNumber!,
          }));
          if (parts.length !== Math.ceil(upload.expectedSize / PART_SIZE))
            throw new ApiError(
              409,
              'PARTS_MISSING',
              'Some upload parts are missing. Retry the transfer.',
            );
          await storage.completeMultipart(
            upload.objectKey,
            upload.uploadSessionId,
            parts,
          );
        }
      }
      const metadata = await storage.headObject(upload.objectKey);
      if (metadata.ContentLength !== upload.expectedSize)
        throw new ApiError(
          400,
          'SIZE_MISMATCH',
          'Stored object size does not match the upload.',
        );
      const sample = await storage.getObject(upload.objectKey, 'bytes=0-8191');
      const storedMime = await verifiedMime(
        await sample.Body!.transformToByteArray(),
        upload.expectedMimeType,
        (
          await db()
            .select({ name: files.originalFilename })
            .from(files)
            .where(eq(files.id, upload.fileId))
        )[0]?.name ?? '',
      );
      const prepare = needsThumbnail(storedMime);
      await db().transaction(async (tx) => {
        await tx.execute(vaultWriteLock);
        const [current] = await tx
          .select()
          .from(uploads)
          .where(eq(uploads.id, upload.id))
          .for('update');
        if (current?.status !== 'verifying')
          throw new ApiError(
            409,
            'UPLOAD_INVALIDATED',
            'Upload verification was cancelled or superseded.',
          );
        const [pendingFile] = await tx
          .select()
          .from(files)
          .where(eq(files.id, upload.fileId))
          .for('update');
        if (
          !pendingFile ||
          pendingFile.processingStatus === 'deleting' ||
          pendingFile.uploadStatus === 'cancelled'
        )
          throw new ApiError(
            410,
            'UPLOAD_INVALIDATED',
            'This upload was cancelled or permanently deleted. Start a new upload.',
          );
        // Copy out of the signed staging key: an unexpired PUT can never overwrite an accepted original.
        const finalKey = `originals/${upload.fileId}`;
        if (!metadata.ETag)
          throw new Error('Stored object version is missing.');
        await storage.copyObject(
          upload.objectKey,
          finalKey,
          metadata.ETag,
          storedMime,
        );
        const finalMetadata = await storage.headObject(finalKey);
        const finalSample = await storage.getObject(finalKey, 'bytes=0-8191');
        const finalMime = await verifiedMime(
          await finalSample.Body!.transformToByteArray(),
          storedMime,
          pendingFile.originalFilename,
        );
        if (finalMime !== storedMime)
          throw new ApiError(
            400,
            'SIGNATURE_MISMATCH',
            'Stored original type changed during verification.',
          );
        if (finalMetadata.ContentLength !== upload.expectedSize)
          throw new ApiError(
            400,
            'COPY_MISMATCH',
            'Stored original failed verification.',
          );
        await assertFolderAccess(user.id, upload.targetFolderId);
        let folderId = upload.targetFolderId;
        if (folderId) {
          const result = await tx.execute(
            sql`select id from folders where id=${folderId} and owner_id=${user.id} and deleted_at is null`,
          );
          if (!result.rows.length) folderId = null;
        }
        await tx
          .update(files)
          .set({
            uploadStatus: 'complete',
            processingStatus: prepare ? 'pending' : 'ready',
            mimeType: storedMime,
            createdAt: new Date(),
            folderId,
            updatedAt: new Date(),
          })
          .where(eq(files.id, upload.fileId));
        await tx
          .update(uploads)
          .set({
            status: 'complete',
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(uploads.id, upload.id));
        if (prepare)
          await tx
            .insert(processingJobs)
            .values({ fileId: upload.fileId, jobType: 'process' });
        await tx.insert(activityEvents).values({
          ownerId: user.id,
          fileId: upload.fileId,
          eventType: 'file_uploaded',
        });
      });
      return {
        success: true,
        fileId: upload.fileId,
        processingStatus: prepare ? 'pending' : 'ready',
      };
    } catch (e) {
      await db()
        .update(uploads)
        .set({
          status: 'pending',
          errorCode: e instanceof ApiError ? e.code : 'VERIFICATION_FAILED',
          updatedAt: new Date(),
        })
        .where(and(eq(uploads.id, upload.id), eq(uploads.status, 'verifying')));
      throw e;
    }
  });
}
