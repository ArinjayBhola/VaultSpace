import { splitFileName } from '@/lib/file-name';
import { workspaceData } from '@/features/files/workspace-query';
import { vaultWriteLock } from '@/db/lock';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import {
  files,
  folders,
  collections,
  collectionFiles,
  activityEvents,
} from '@/db/schema';
import { owner, ApiError } from '@/lib/auth';
import { respond, originGuard, readJSON } from '@/lib/api';
import { searchFilters, id, name } from '@/lib/validation';
import {
  mutateFiles,
  folderMutation,
  ownedFile,
  event,
} from '@/features/files/service';
import { emptyTrash } from '@/lib/trash';
export async function GET(request: Request) {
  return respond(async () => {
    const user = await owner();
    const params = new URL(request.url).searchParams;
    const query = searchFilters.parse({
      ...Object.fromEntries(params),
      type: params.getAll('type'),
    });
    return workspaceData(user.id, query);
  });
}
const mutation = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('empty-trash') }),
  z.object({ operation: z.literal('folder-delete'), id }),
  z.object({
    operation: z.literal('bulk'),
    ids: z.array(id).min(1).max(100),
    action: z.enum([
      'star',
      'unstar',
      'trash',
      'restore',
      'move',
      'delete',
      'reprocess',
    ]),
    folderId: id.nullable().optional(),
  }),
  z.object({
    operation: z.literal('rename'),
    id,
    name,
    description: z.string().max(10000).optional(),
  }),
  z.object({
    operation: z.literal('folder-create'),
    name,
    parentId: id.nullable().default(null),
    description: z.string().max(2000).default(''),
  }),
  z.object({
    operation: z.literal('folder-action'),
    id,
    action: z.enum(['rename', 'move', 'trash', 'restore']),
    name: name.optional(),
    parentId: id.nullable().optional(),
  }),
  z.object({
    operation: z.literal('collection-create'),
    name,
    description: z.string().max(2000).default(''),
  }),
  z.object({
    operation: z.literal('collection-update'),
    id,
    name,
    description: z.string().max(2000).default(''),
  }),
  z.object({ operation: z.literal('collection-delete'), id }),
  z.object({
    operation: z.literal('collection-membership'),
    collectionId: id,
    ids: z.array(id).min(1).max(100),
    remove: z.boolean().default(false),
  }),
]);
export async function POST(request: Request) {
  return respond(async () => {
    originGuard(request);
    const user = await owner();
    const input = mutation.parse(await readJSON(request));
    if (
      input.operation === 'empty-trash' ||
      input.operation === 'folder-delete'
    ) {
      const result = await emptyTrash(
        user.id,
        input.operation === 'folder-delete' ? input.id : undefined,
      );
      return {
        ...result,
        followUp: {
          delivered: true,
          message:
            'File preparation and cleanup continue while the app is open.',
        },
      };
    }
    if (input.operation === 'bulk') {
      const result = await mutateFiles(
        user.id,
        [...new Set(input.ids)],
        input.action,
        input.folderId,
      );
      if (['delete', 'reprocess', 'restore'].includes(input.action))
        return {
          ...result,
          followUp: {
            delivered: true,
            message:
              'File preparation and cleanup continue while the app is open.',
          },
        };
      return result;
    }
    if (input.operation === 'rename') {
      const file = await ownedFile(user.id, input.id);
      if (
        splitFileName(input.name).extension !==
        splitFileName(file.displayName).extension
      )
        throw new ApiError(
          400,
          'EXTENSION_LOCKED',
          'The file extension cannot be changed. Edit only the file name.',
        );
      if (
        input.name === file.displayName &&
        (input.description === undefined ||
          input.description === file.description)
      )
        return { success: true, changed: false };
      await db().transaction(async (tx) => {
        await tx
          .update(files)
          .set({
            displayName: input.name,
            description: input.description,
            updatedAt: new Date(),
          })
          .where(and(eq(files.id, input.id), eq(files.ownerId, user.id)));
        await tx.insert((await import('@/db/schema')).activityEvents).values({
          ownerId: user.id,
          fileId: input.id,
          eventType: 'file_renamed',
        });
      });
      return { success: true };
    }
    if (input.operation === 'folder-create')
      return db().transaction(async (tx) => {
        await tx.execute(vaultWriteLock);
        if (input.parentId) {
          const [parent] = await tx
            .select()
            .from(folders)
            .where(
              and(
                eq(folders.id, input.parentId),
                eq(folders.ownerId, user.id),
                isNull(folders.deletedAt),
              ),
            );
          if (!parent)
            throw new ApiError(
              404,
              'FOLDER_NOT_FOUND',
              'Destination folder is unavailable.',
            );
        }
        const [folder] = await tx
          .insert(folders)
          .values({
            ownerId: user.id,
            parentId: input.parentId,
            name: input.name,
            description: input.description,
          })
          .returning();
        await tx
          .insert(activityEvents)
          .values({ ownerId: user.id, eventType: 'folder_created' });
        return folder;
      });
    if (input.operation === 'folder-action') {
      if (input.action === 'rename' && !input.name)
        throw new ApiError(400, 'NAME_REQUIRED', 'Enter a folder name.');
      const result = await folderMutation(
        user.id,
        input.id,
        input.action,
        input.action === 'rename' ? input.name : input.parentId,
      );
      return result;
    }
    if (input.operation === 'collection-create') {
      const [collection] = await db()
        .insert(collections)
        .values({
          ownerId: user.id,
          name: input.name,
          description: input.description,
        })
        .returning();
      await event(user.id, 'collection_created');
      return collection;
    }
    const collectionId =
      input.operation === 'collection-membership'
        ? input.collectionId
        : input.id;
    const [collection] = await db()
      .select()
      .from(collections)
      .where(
        and(
          eq(collections.id, collectionId),
          eq(collections.ownerId, user.id),
          isNull(collections.deletedAt),
        ),
      );
    if (!collection)
      throw new ApiError(404, 'NOT_FOUND', 'Collection not found.');
    if (input.operation === 'collection-delete')
      await db().delete(collections).where(eq(collections.id, collection.id));
    if (input.operation === 'collection-update')
      await db()
        .update(collections)
        .set({
          name: input.name,
          description: input.description,
          updatedAt: new Date(),
        })
        .where(eq(collections.id, collection.id));
    if (input.operation === 'collection-membership')
      await db().transaction(async (tx) => {
        for (const fileId of [...new Set(input.ids)]) {
          await ownedFile(user.id, fileId);
          if (input.remove)
            await tx
              .delete(collectionFiles)
              .where(
                and(
                  eq(collectionFiles.collectionId, collection.id),
                  eq(collectionFiles.fileId, fileId),
                ),
              );
          else
            await tx
              .insert(collectionFiles)
              .values({ collectionId: collection.id, fileId })
              .onConflictDoNothing();
        }
      });
    return { success: true };
  });
}
