import { needsThumbnail } from '@/lib/file-types';
import { eq, and, sql, desc, lt, inArray } from 'drizzle-orm';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { join, sep } from 'node:path';
import { db } from '@/db';
import { vaultWriteLock } from '@/db/lock';
import {
  files,
  processingJobs,
  settings,
  uploads,
  activityEvents,
  rateLimit,
  shareViewers,
} from '@/db/schema';
import * as storage from '@/lib/storage';
import { pdfThumbnail } from '@/lib/pdf-thumbnail';
type Operation = typeof processingJobs.$inferSelect;
async function executeOperation(job: Operation) {
  await db()
    .update(processingJobs)
    .set({
      attempts: sql`${processingJobs.attempts}+1`,
      updatedAt: new Date(),
    })
    .where(eq(processingJobs.id, job.id));
  const [file] = await db()
    .select()
    .from(files)
    .where(eq(files.id, job.fileId));
  if (!file || file.processingVersion !== job.generation) {
    await db()
      .update(processingJobs)
      .set({ status: 'cancelled', completedAt: new Date() })
      .where(eq(processingJobs.id, job.id));
    return { skipped: true };
  }
  if (job.jobType === 'delete') {
    if (!file.deletedAt) {
      await db()
        .update(processingJobs)
        .set({ status: 'cancelled', completedAt: new Date() })
        .where(eq(processingJobs.id, job.id));
      return { cancelled: true };
    }
    await db()
      .update(uploads)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(
          eq(uploads.fileId, file.id),
          sql`${uploads.status} in ('pending','verifying')`,
        ),
      );
    await storage.deleteObject(file.r2ObjectKey);
    await storage.deleteObject(`derived/${file.id}/thumbnail.webp`);
    if (file.thumbnailKey) await storage.deleteObject(file.thumbnailKey);
    const staging = await db()
      .select()
      .from(uploads)
      .where(eq(uploads.fileId, file.id));
    for (const upload of staging) {
      if (upload.uploadSessionId) {
        try {
          await storage.abortMultipart(
            upload.objectKey,
            upload.uploadSessionId,
          );
        } catch (error) {
          if (!(error instanceof Error) || error.name !== 'NoSuchUpload')
            throw error;
        }
      }
      await storage.deleteObject(upload.objectKey);
    }
    await db().transaction(async (tx) => {
      await tx.execute(vaultWriteLock);
      await tx.insert(activityEvents).values({
        ownerId: file.ownerId,
        eventType: 'file_permanently_deleted',
      });
      await tx
        .delete(files)
        .where(and(eq(files.id, file.id), sql`${files.deletedAt} is not null`));
      for (let pass = 0; pass < 100; pass++) {
        const removed = await tx.execute(
          sql`delete from folders f where f.owner_id=${file.ownerId} and f.purge_requested_at is not null and not exists(select 1 from files x where x.folder_id=f.id) and not exists(select 1 from folders c where c.parent_id=f.id) returning f.id`,
        );
        if (!removed.rows.length) break;
      }
    });
    return { deleted: true };
  }
  if (file.deletedAt || file.processingStatus === 'deleting') {
    await db()
      .update(processingJobs)
      .set({ status: 'cancelled' })
      .where(eq(processingJobs.id, job.id));
    return { skipped: true };
  }
  if (!needsThumbnail(file.mimeType)) {
    await db().transaction(async (tx) => {
      await tx.execute(vaultWriteLock);
      const changed = await tx
        .update(files)
        .set({ processingStatus: 'ready', updatedAt: new Date() })
        .where(
          and(
            eq(files.id, file.id),
            eq(files.processingVersion, job.generation),
            sql`${files.deletedAt} is null`,
          ),
        )
        .returning({ id: files.id });
      await tx
        .update(processingJobs)
        .set({
          status: changed.length ? 'complete' : 'cancelled',
          lastError: null,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(processingJobs.id, job.id));
    });
    return { status: 'ready' };
  }
  const limit = Math.min(
    Number(process.env.MAX_PROCESSING_BYTES || 52428800),
    52428800,
  );
  if (file.sizeBytes > limit) {
    await db()
      .update(files)
      .set({ processingStatus: 'limit_exceeded' })
      .where(
        and(eq(files.id, file.id), eq(files.processingVersion, job.generation)),
      );
    await db()
      .update(processingJobs)
      .set({
        status: 'blocked',
        lastError:
          'File exceeds the configured request processing byte limit. Original remains available.',
        updatedAt: new Date(),
      })
      .where(eq(processingJobs.id, job.id));
    return { blocked: true };
  }
  await db()
    .update(files)
    .set({ processingStatus: 'processing' })
    .where(
      and(eq(files.id, file.id), eq(files.processingVersion, job.generation)),
    );
  const object = await storage.getObject(file.r2ObjectKey);
  if (!object.Body) throw new Error('Original object is unavailable.');
  const body = await object.Body.transformToByteArray();
  const checksum =
    file.checksum || createHash('sha256').update(body).digest('hex');
  let thumbnailKey: string | null = file.thumbnailKey;
  let thumbnailBytes = file.thumbnailBytes;
  let pageCount = file.pageCount;
  let width = file.width;
  let height = file.height;
  if (file.mimeType === 'application/pdf') {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const assetDirectory = (name: string) =>
      join(process.cwd(), 'node_modules', 'pdfjs-dist', name) + sep;
    const loading = getDocument({
      data: body,
      useSystemFonts: true,
      disableFontFace: true,
      cMapUrl: assetDirectory('cmaps'),
      cMapPacked: true,
      standardFontDataUrl: assetDirectory('standard_fonts'),
      wasmUrl: assetDirectory('wasm'),
      iccUrl: assetDirectory('iccs'),
    });
    let document;
    try {
      document = await loading.promise;
    } catch (error) {
      if (
        error instanceof Error &&
        ['PasswordException', 'InvalidPDFException'].includes(error.name)
      ) {
        await loading.destroy();
        const status =
          error.name === 'PasswordException'
            ? 'password_required'
            : 'corrupt_pdf';
        await db()
          .update(files)
          .set({ processingStatus: status })
          .where(
            and(
              eq(files.id, file.id),
              eq(files.processingVersion, job.generation),
            ),
          );
        await db()
          .update(processingJobs)
          .set({
            status: 'blocked',
            lastError:
              error.name === 'PasswordException'
                ? 'Encrypted PDF requires a password. Keep the original or upload an unlocked copy.'
                : 'PDF structure is corrupt and could not be processed.',
            updatedAt: new Date(),
          })
          .where(eq(processingJobs.id, job.id));
        return { blocked: true, status };
      }
      throw error;
    }
    pageCount = document.numPages;
    try {
      const page = await document.getPage(1);
      try {
        const thumbnail = await pdfThumbnail(page);
        thumbnailKey = `derived/${file.id}/thumbnail.webp`;
        thumbnailBytes = thumbnail.length;
        await storage.putObject(thumbnailKey, thumbnail, 'image/webp');
      } finally {
        page.cleanup();
      }
    } finally {
      await loading.destroy();
    }
  } else {
    const image = sharp(body, {
      animated: false,
      limitInputPixels: 100000000,
    });
    const metadata = await image.metadata();
    width = metadata.width ?? null;
    height = metadata.height ?? null;
    const thumbnail = await image
      .rotate()
      .resize(640, 480, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    thumbnailKey = `derived/${file.id}/thumbnail.webp`;
    thumbnailBytes = thumbnail.length;
    await storage.putObject(thumbnailKey, thumbnail, 'image/webp');
    await db()
      .update(files)
      .set({ thumbnailKey, thumbnailBytes, width, height, checksum })
      .where(
        and(
          eq(files.id, file.id),
          eq(files.processingVersion, job.generation),
          sql`${files.deletedAt} is null`,
        ),
      );
  }
  await db().transaction(async (tx) => {
    await tx.execute(vaultWriteLock);
    const [current] = await tx
      .select()
      .from(files)
      .where(eq(files.id, file.id))
      .for('update');
    if (
      !current ||
      current.processingVersion !== job.generation ||
      current.deletedAt
    ) {
      await tx
        .update(processingJobs)
        .set({ status: 'cancelled', completedAt: new Date() })
        .where(eq(processingJobs.id, job.id));
      return;
    }
    await tx
      .update(files)
      .set({
        checksum,
        thumbnailKey,
        thumbnailBytes,
        width,
        height,
        pageCount,
        processingStatus: 'ready',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(files.id, file.id),
          eq(files.processingVersion, job.generation),
          sql`${files.deletedAt} is null`,
          sql`${files.processingStatus} != 'deleting'`,
        ),
      );
    await tx
      .update(processingJobs)
      .set({
        status: 'complete',
        completedAt: new Date(),
        updatedAt: new Date(),
        lastError: null,
      })
      .where(eq(processingJobs.id, job.id));
    await tx.insert(activityEvents).values({
      ownerId: file.ownerId,
      fileId: file.id,
      eventType: 'processing_completed',
    });
  });
  return { status: 'ready' };
}

async function maintenance(ownerId: string, force = false) {
  const key = `maintenance:${ownerId}`;
  const [lease] = await db()
    .insert(rateLimit)
    .values({ id: key, key, count: 1, lastRequest: Date.now() })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: { lastRequest: Date.now() },
      setWhere: force
        ? sql`true`
        : sql`${rateLimit.lastRequest}<${Date.now() - 60000}`,
    })
    .returning({ id: rateLimit.id });
  if (!lease) return;
  const stale = await db()
    .select()
    .from(uploads)
    .where(and(eq(uploads.ownerId, ownerId), lt(uploads.expiresAt, new Date())))
    .limit(1);
  for (const upload of stale) {
    if (
      upload.status === 'verifying' &&
      upload.updatedAt.getTime() > Date.now() - 3600000
    )
      continue;
    if (upload.status !== 'complete') {
      const claimed = await db()
        .update(uploads)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(
          and(
            eq(uploads.id, upload.id),
            sql`(${uploads.status} in ('pending','cancelled') or (${uploads.status}='verifying' and ${uploads.updatedAt}<now()-interval '1 hour'))`,
          ),
        )
        .returning();
      if (!claimed.length) continue;
    }
    if (upload.uploadSessionId && upload.status !== 'complete') {
      try {
        await storage.abortMultipart(upload.objectKey, upload.uploadSessionId);
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'NoSuchUpload')
          throw error;
      }
    }
    await storage.deleteObject(upload.objectKey);
    if (upload.status !== 'complete') {
      await storage.deleteObject(`originals/${upload.fileId}`);
      await db()
        .delete(files)
        .where(
          and(
            eq(files.id, upload.fileId),
            sql`${files.uploadStatus} != 'complete'`,
          ),
        );
    } else await db().delete(uploads).where(eq(uploads.id, upload.id));
  }
  await db()
    .delete(activityEvents)
    .where(
      sql`${activityEvents.ownerId}=${ownerId} and ${activityEvents.createdAt}<now()-interval '180 days'`,
    );
  await db()
    .delete(processingJobs)
    .where(
      sql`${processingJobs.status} in ('complete','cancelled','failed','blocked') and ${processingJobs.updatedAt}<now()-interval '90 days'`,
    );
  await db()
    .delete(rateLimit)
    .where(
      sql`${rateLimit.lastRequest}<extract(epoch from now()-interval '7 days')*1000`,
    );
  await db()
    .delete(shareViewers)
    .where(
      sql`${shareViewers.lastSeenAt}<now()-interval '2 minutes' or ${shareViewers.expiresAt}<now()`,
    );
  // Files are removed by durable cleanup first. Remove empty folders from
  // leaves upward; an interrupted pass is safe to repeat next visit.
  for (let pass = 0; pass < 100; pass++) {
    const result = await db().execute(
      sql`delete from folders f where f.owner_id=${ownerId} and f.purge_requested_at is not null and not exists(select 1 from files x where x.folder_id=f.id) and not exists(select 1 from folders c where c.parent_id=f.id) returning f.id`,
    );
    if (!result.rows.length) break;
  }

  const [preferences] = await db()
    .select()
    .from(settings)
    .where(eq(settings.ownerId, ownerId));
  if (preferences?.trashRetentionDays) {
    await db().transaction(async (tx) => {
      await tx.execute(vaultWriteLock);
      const old = await tx
        .select({ id: files.id, version: files.processingVersion })
        .from(files)
        .where(
          and(
            eq(files.ownerId, ownerId),
            sql`${files.deletedAt}<now()-make_interval(days=>${preferences.trashRetentionDays})`,
            sql`${files.processingStatus}!='deleting'`,
          ),
        )
        .limit(10);
      if (old.length) {
        await tx.insert(processingJobs).values(
          old.map((file) => ({
            fileId: file.id,
            jobType: 'delete',
            generation: file.version + 1,
          })),
        );
        await tx
          .update(files)
          .set({
            processingStatus: 'deleting',
            processingVersion: sql`${files.processingVersion}+1`,
          })
          .where(
            inArray(
              files.id,
              old.map((file) => file.id),
            ),
          );
      }
    });
  }
}
export async function advanceOperations(
  ownerId: string,
  forceMaintenance = false,
) {
  const operation = await db().transaction(async (tx) => {
    const [row] = await tx
      .select({ operation: processingJobs })
      .from(processingJobs)
      .innerJoin(files, eq(files.id, processingJobs.fileId))
      .where(
        and(
          eq(files.ownerId, ownerId),
          eq(files.uploadStatus, 'complete'),
          eq(processingJobs.generation, files.processingVersion),
          sql`not exists(select 1 from processing_jobs busy where busy.file_id=${files.id} and busy.id!=${processingJobs.id} and busy.status='running' and busy.updated_at>now()-interval '3 minutes')`,
          sql`(${processingJobs.status}='pending' or (${processingJobs.status}='running' and ${processingJobs.updatedAt}<now()-interval '3 minutes'))`,
        ),
      )
      .orderBy(
        desc(sql`${processingJobs.jobType}='delete'`),
        processingJobs.createdAt,
      )
      .limit(1)
      .for('update', { skipLocked: true });
    if (!row) return null;
    const [claimed] = await tx
      .update(processingJobs)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(processingJobs.id, row.operation.id))
      .returning();
    return claimed;
  });
  let operationError: string | null = null;
  if (operation) {
    try {
      await executeOperation(operation);
    } catch (error) {
      const storageDenied =
        error instanceof Error && error.name === 'AccessDenied';
      operationError = storageDenied
        ? 'Storage denied this operation. Check R2 Object Read & Write permissions, then retry.'
        : operation.jobType === 'delete'
          ? 'File cleanup failed. The tracked file is retained; retry permanent deletion.'
          : 'File preparation failed. Your original is available; retry preparation from file details.';
      await db().transaction(async (tx) => {
        await tx.execute(vaultWriteLock);
        await tx
          .update(processingJobs)
          .set({
            status: 'failed',
            lastError: operationError,
            updatedAt: new Date(),
          })
          .where(eq(processingJobs.id, operation.id));
        const changed = await tx
          .update(files)
          .set({
            processingStatus:
              operation.jobType === 'delete' ? 'deleting' : 'failed',
          })
          .where(
            and(
              eq(files.id, operation.fileId),
              eq(files.processingVersion, operation.generation),
            ),
          )
          .returning({ id: files.id });
        if (changed.length)
          await tx.insert(activityEvents).values({
            ownerId,
            fileId: operation.fileId,
            eventType: 'processing_failed',
            metadata: { operation: operation.jobType },
          });
      });
      console.error(
        'file_operation_failed',
        error instanceof Error ? error.name : 'UnknownError',
      );
    }
  }
  let maintenanceError: string | null = null;
  try {
    await maintenance(ownerId, forceMaintenance);
  } catch (error) {
    maintenanceError =
      'Storage maintenance needs attention. Check R2 access and try again.';
    console.error(
      'file_maintenance_failed',
      error instanceof Error ? error.name : 'UnknownError',
    );
  }
  const [remaining] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(processingJobs)
    .innerJoin(files, eq(files.id, processingJobs.fileId))
    .where(
      and(
        eq(files.ownerId, ownerId),
        eq(processingJobs.generation, files.processingVersion),
        inArray(processingJobs.status, ['pending', 'running']),
      ),
    );
  const [failed] = await db()
    .select({
      id: processingJobs.fileId,
      type: processingJobs.jobType,
      error: processingJobs.lastError,
    })
    .from(processingJobs)
    .innerJoin(files, eq(files.id, processingJobs.fileId))
    .where(
      and(
        eq(files.ownerId, ownerId),
        eq(processingJobs.generation, files.processingVersion),
        eq(processingJobs.status, 'failed'),
      ),
    )
    .orderBy(desc(processingJobs.updatedAt))
    .limit(1);
  return {
    changed: Boolean(operation),
    remaining: remaining.count,
    error: operationError || maintenanceError || failed?.error || null,
    retry:
      operationError && operation
        ? {
            id: operation.fileId,
            action: operation.jobType === 'delete' ? 'delete' : 'reprocess',
          }
        : failed
          ? {
              id: failed.id,
              action: failed.type === 'delete' ? 'delete' : 'reprocess',
            }
          : null,
  };
}
