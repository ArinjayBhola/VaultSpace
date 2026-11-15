import { z } from 'zod';
import { and, eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import {
  pdfAnnotations,
  pdfBookmarks,
  pdfReadingProgress,
  activityEvents,
} from '@/db/schema';
import { owner, ApiError } from '@/lib/auth';
import { originGuard, respond, readJSON } from '@/lib/api';
import { id } from '@/lib/validation';
import { ownedFile } from '@/features/files/service';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return respond(async () => {
    const user = await owner();
    const file = await ownedFile(user.id, id.parse((await context.params).id));
    if (file.mimeType !== 'application/pdf')
      throw new ApiError(400, 'NOT_PDF', 'This file is not a PDF.');
    const [annotations, bookmarks, progress] = await Promise.all([
      db()
        .select()
        .from(pdfAnnotations)
        .where(eq(pdfAnnotations.fileId, file.id))
        .orderBy(asc(pdfAnnotations.pageNumber))
        .limit(5000),
      db()
        .select()
        .from(pdfBookmarks)
        .where(eq(pdfBookmarks.fileId, file.id))
        .orderBy(asc(pdfBookmarks.pageNumber))
        .limit(2000),
      db()
        .select()
        .from(pdfReadingProgress)
        .where(eq(pdfReadingProgress.fileId, file.id)),
    ]);
    return {
      file: {
        id: file.id,
        name: file.displayName,
        pageCount: file.pageCount,
        processingStatus: file.processingStatus,
      },
      annotations,
      bookmarks,
      progress: progress[0] ?? null,
    };
  });
}
const page = z.number().int().min(1).max(100000);
const annotation = z.object({
  pageNumber: page,
  annotationType: z.enum(['highlight', 'note']),
  selectedText: z.string().max(20000).nullable(),
  anchorData: z.record(z.string(), z.unknown()).nullable(),
  geometryData: z
    .array(
      z.object({
        x: z.number().finite().min(-100000).max(100000),
        y: z.number().finite().min(-100000).max(100000),
        width: z.number().min(0).max(100000),
        height: z.number().min(0).max(100000),
      }),
    )
    .max(500)
    .nullable(),
  color: z.enum(['#fde047', '#86efac', '#93c5fd', '#f9a8d4']),
  note: z.string().max(20000),
});
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('annotate'), ...annotation.shape }),
  z.object({
    action: z.literal('annotation-update'),
    id,
    note: z.string().max(20000),
    color: annotation.shape.color,
  }),
  z.object({ action: z.literal('annotation-delete'), id }),
  z.object({
    action: z.literal('bookmark'),
    pageNumber: page,
    label: z.string().trim().min(1).max(200),
  }),
  z.object({
    action: z.literal('bookmark-update'),
    id,
    label: z.string().trim().min(1).max(200),
  }),
  z.object({ action: z.literal('bookmark-delete'), id }),
  z.object({
    action: z.literal('progress'),
    pageNumber: page,
    zoomLevel: z.number().int().min(25).max(400),
  }),
]);
export async function POST(request: Request, context: Context) {
  return respond(async () => {
    originGuard(request);
    const user = await owner();
    const file = await ownedFile(user.id, id.parse((await context.params).id));
    if (file.mimeType !== 'application/pdf')
      throw new ApiError(400, 'NOT_PDF', 'This file is not a PDF.');
    const input = schema.parse(await readJSON(request));
    if (
      'pageNumber' in input &&
      file.pageCount &&
      input.pageNumber > file.pageCount
    )
      throw new ApiError(400, 'INVALID_PAGE', 'Page is outside this document.');
    if (input.action === 'annotate') {
      const { action, ...values } = input;
      void action;
      await db().transaction(async (tx) => {
        await tx.insert(pdfAnnotations).values({ fileId: file.id, ...values });
        await tx.insert(activityEvents).values({
          ownerId: user.id,
          fileId: file.id,
          eventType: 'pdf_annotation_created',
        });
      });
    }
    if (input.action === 'annotation-update')
      await db()
        .update(pdfAnnotations)
        .set({ note: input.note, color: input.color, updatedAt: new Date() })
        .where(
          and(
            eq(pdfAnnotations.id, input.id),
            eq(pdfAnnotations.fileId, file.id),
          ),
        );
    if (input.action === 'annotation-delete')
      await db()
        .delete(pdfAnnotations)
        .where(
          and(
            eq(pdfAnnotations.id, input.id),
            eq(pdfAnnotations.fileId, file.id),
          ),
        );
    if (input.action === 'bookmark')
      await db().insert(pdfBookmarks).values({
        fileId: file.id,
        pageNumber: input.pageNumber,
        label: input.label,
      });
    if (input.action === 'bookmark-update')
      await db()
        .update(pdfBookmarks)
        .set({ label: input.label })
        .where(
          and(eq(pdfBookmarks.id, input.id), eq(pdfBookmarks.fileId, file.id)),
        );
    if (input.action === 'bookmark-delete')
      await db()
        .delete(pdfBookmarks)
        .where(
          and(eq(pdfBookmarks.id, input.id), eq(pdfBookmarks.fileId, file.id)),
        );
    if (input.action === 'progress')
      await db()
        .insert(pdfReadingProgress)
        .values({
          fileId: file.id,
          pageNumber: input.pageNumber,
          zoomLevel: input.zoomLevel,
        })
        .onConflictDoUpdate({
          target: pdfReadingProgress.fileId,
          set: {
            pageNumber: input.pageNumber,
            zoomLevel: input.zoomLevel,
            updatedAt: new Date(),
          },
        });
    return { success: true };
  });
}
