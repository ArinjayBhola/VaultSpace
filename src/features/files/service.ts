import { vaultWriteLock } from '@/db/lock';
import {
  and,
  eq,
  isNull,
  sql,
  desc,
  asc,
  inArray,
  isNotNull,
  type SQL,
} from 'drizzle-orm';
import { db } from '@/db';
import {
  files,
  folders,
  collections,
  activityEvents,
  shareLinks,
  processingJobs,
} from '@/db/schema';
import { ApiError } from '@/lib/auth';
import { searchFilters, wouldCycle } from '@/lib/validation';
import { z } from 'zod';
export async function ownedFile(
  ownerId: string,
  fileId: string,
  includeTrash = false,
) {
  const [file] = await db()
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.ownerId, ownerId),
        includeTrash ? undefined : isNull(files.deletedAt),
      ),
    );
  if (!file || file.uploadStatus !== 'complete')
    throw new ApiError(404, 'NOT_FOUND', 'File not found.');
  return file;
}
export async function checkFolder(ownerId: string, folderId: string | null) {
  if (!folderId) return;
  const [folder] = await db()
    .select()
    .from(folders)
    .where(
      and(
        eq(folders.id, folderId),
        eq(folders.ownerId, ownerId),
        isNull(folders.deletedAt),
      ),
    );
  if (!folder)
    throw new ApiError(
      404,
      'FOLDER_NOT_FOUND',
      'Destination folder is unavailable.',
    );
}
export async function event(
  ownerId: string,
  eventType: string,
  fileId?: string,
  metadata: Record<string, unknown> = {},
) {
  await db()
    .insert(activityEvents)
    .values({ ownerId, eventType, fileId, metadata });
}
export type FileRecord = typeof files.$inferSelect;
export async function listFiles(
  ownerId: string,
  input: z.infer<typeof searchFilters>,
) {
  const conditions: SQL[] = [
    eq(files.ownerId, ownerId),
    eq(files.uploadStatus, 'complete'),
    input.view === 'trash'
      ? isNotNull(files.deletedAt)
      : isNull(files.deletedAt),
  ];
  if (input.folder) conditions.push(eq(files.folderId, input.folder));
  else if (input.view === 'root') conditions.push(isNull(files.folderId));
  if (input.view === 'starred' || input.starred === 'true')
    conditions.push(isNotNull(files.starredAt));
  if (input.starred === 'false') conditions.push(isNull(files.starredAt));
  if (input.view === 'documents' || input.type === 'pdf')
    conditions.push(eq(files.mimeType, 'application/pdf'));
  if (input.type === 'images')
    conditions.push(sql`${files.mimeType} like 'image/%'`);
  else if (!['all', 'pdf'].includes(input.type))
    conditions.push(
      input.type.startsWith('mime:')
        ? eq(files.mimeType, input.type.slice(5))
        : eq(files.extension, input.type),
    );
  if (input.collection)
    conditions.push(
      sql`exists(select 1 from collection_files cf join collections c on c.id=cf.collection_id where cf.file_id=${files.id} and cf.collection_id=${input.collection} and c.owner_id=${ownerId} and c.deleted_at is null)`,
    );
  if (input.minSize !== undefined)
    conditions.push(sql`${files.sizeBytes} >= ${input.minSize}`);
  if (input.maxSize !== undefined)
    conditions.push(sql`${files.sizeBytes} <= ${input.maxSize}`);
  if (input.after)
    conditions.push(sql`${files.createdAt} >= ${input.after}::timestamptz`);
  if (input.before)
    conditions.push(sql`${files.createdAt} <= ${input.before}::timestamptz`);
  if (input.status) conditions.push(eq(files.processingStatus, input.status));
  const q = input.q.trim();
  const pattern = '%' + q.replace(/[%_\\]/g, '\\$&') + '%';
  const lexical = sql`(${files.displayName} ilike ${pattern} or ${files.originalFilename} ilike ${pattern} or ${files.extension} ilike ${pattern} or ${files.mimeType} ilike ${pattern})`;
  const lexicalScore = sql`(case when lower(${files.displayName})=lower(${q}) then 3 when ${files.displayName} ilike ${pattern} then 2 else 1 end)`;
  if (q) conditions.push(lexical);
  const where = and(...conditions);
  const column =
    input.view === 'recent' && ['created', 'relevance'].includes(input.sort)
      ? sql`coalesce(${files.lastAccessedAt},${files.createdAt})`
      : {
          relevance: files.createdAt,
          name: files.displayName,
          created: files.createdAt,
          modified: files.updatedAt,
          size: files.sizeBytes,
          type: files.mimeType,
        }[input.sort];
  const ranking = lexicalScore;
  const [[{ count }], rows] = await Promise.all([
    db()
      .select({ count: sql<number>`count(*)::int` })
      .from(files)
      .where(where),
    db()
      .select({
        id: files.id,
        folderId: files.folderId,
        displayName: files.displayName,
        originalFilename: files.originalFilename,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
        createdAt: files.createdAt,
        updatedAt: files.updatedAt,
        deletedAt: files.deletedAt,
        starredAt: files.starredAt,
        processingStatus: files.processingStatus,
        description: files.description,
        pageCount: files.pageCount,
        width: files.width,
        height: files.height,
        activeShareCount: sql<number>`(select count(*)::int from share_links s where s.file_id=${files.id} and s.revoked_at is null and (s.expires_at is null or s.expires_at>now()))`,
        hasThumbnail: sql<boolean>`${files.thumbnailKey} is not null`,
        relevance: q ? ranking : sql<number>`0`,
      })
      .from(files)
      .where(where)
      .orderBy(
        q && input.sort === 'relevance'
          ? desc(ranking)
          : input.direction === 'asc'
            ? asc(column)
            : desc(column),
        desc(files.id),
      )
      .limit(input.limit)
      .offset((input.page - 1) * input.limit),
  ]);
  return {
    files: rows,
    count,
    page: input.page,
    limit: input.limit,
    updatedAt: new Date().toISOString(),
  };
}
export async function mutateFiles(
  ownerId: string,
  ids: string[],
  action:
    'star' | 'unstar' | 'trash' | 'restore' | 'move' | 'delete' | 'reprocess',
  folderId?: string | null,
) {
  if (action === 'move') await checkFolder(ownerId, folderId ?? null);
  return db().transaction(async (tx) => {
    await tx.execute(vaultWriteLock);
    if (action === 'move') await checkFolder(ownerId, folderId ?? null);
    const rows = await tx
      .select()
      .from(files)
      .where(and(eq(files.ownerId, ownerId), inArray(files.id, ids)));
    if (rows.length !== ids.length)
      throw new ApiError(
        404,
        'NOT_FOUND',
        'Some files are no longer available.',
      );
    for (const file of rows) {
      if (file.processingStatus === 'deleting' && action !== 'delete')
        throw new ApiError(
          409,
          'DELETION_IN_PROGRESS',
          'Permanent deletion has started. This file can no longer be restored or changed.',
        );
      if (file.deletedAt && !['restore', 'delete'].includes(action))
        throw new ApiError(
          409,
          'FILE_TRASHED',
          'Restore this file before changing or reprocessing it.',
        );
      if (action === 'delete' && !file.deletedAt)
        throw new ApiError(
          409,
          'NOT_TRASHED',
          'Move files to trash before permanently deleting them.',
        );
      if (action === 'delete' || action === 'reprocess') {
        if (action === 'delete') {
          const [existing] = await tx
            .select({ id: processingJobs.id })
            .from(processingJobs)
            .where(
              and(
                eq(processingJobs.fileId, file.id),
                eq(processingJobs.jobType, 'delete'),
                eq(processingJobs.generation, file.processingVersion),
                inArray(processingJobs.status, ['pending', 'running']),
              ),
            )
            .limit(1);
          if (existing) continue;
        }
        await tx.insert(processingJobs).values({
          fileId: file.id,
          jobType: action === 'delete' ? 'delete' : 'process',
          generation: file.processingVersion + 1,
        });
        await tx
          .update(files)
          .set({
            processingStatus: action === 'delete' ? 'deleting' : 'pending',
            processingVersion: file.processingVersion + 1,
            updatedAt: new Date(),
          })
          .where(eq(files.id, file.id));
      } else {
        const retryOnRestore =
          action === 'restore' &&
          ['pending', 'processing', 'failed'].includes(file.processingStatus);
        if (retryOnRestore)
          await tx.insert(processingJobs).values({
            fileId: file.id,
            jobType: 'process',
            generation: file.processingVersion + 1,
          });
        let restoreFolder = file.folderId;
        if (action === 'restore' && restoreFolder) {
          const [parent] = await tx
            .select()
            .from(folders)
            .where(
              and(eq(folders.id, restoreFolder), isNull(folders.deletedAt)),
            );
          if (!parent) restoreFolder = null;
        }
        await tx
          .update(files)
          .set({
            updatedAt: new Date(),
            ...(retryOnRestore
              ? {
                  processingStatus: 'pending',
                  processingVersion: file.processingVersion + 1,
                }
              : {}),
            ...(action === 'star'
              ? { starredAt: new Date() }
              : action === 'unstar'
                ? { starredAt: null }
                : action === 'trash'
                  ? { deletedAt: new Date(), deletionRootId: null }
                  : action === 'restore'
                    ? {
                        deletedAt: null,
                        deletionRootId: null,
                        folderId: restoreFolder,
                      }
                    : { folderId: folderId ?? null }),
          })
          .where(eq(files.id, file.id));
      }
      if (action === 'trash')
        await tx
          .update(shareLinks)
          .set({ revokedAt: new Date() })
          .where(eq(shareLinks.fileId, file.id));
      await tx
        .insert(activityEvents)
        .values({ ownerId, fileId: file.id, eventType: `file_${action}` });
    }
    return { success: true, count: rows.length };
  });
}
export async function listFolders(
  ownerId: string,
  parentId: string | null,
  trash = false,
  page = 1,
) {
  return db()
    .select()
    .from(folders)
    .where(
      and(
        eq(folders.ownerId, ownerId),
        trash ? isNotNull(folders.deletedAt) : isNull(folders.deletedAt),
        trash
          ? undefined
          : parentId
            ? eq(folders.parentId, parentId)
            : isNull(folders.parentId),
      ),
    )
    .orderBy(asc(folders.name))
    .limit(100)
    .offset((page - 1) * 100);
}
export async function listCollections(
  ownerId: string,
  collectionId?: string,
  page = 1,
  query = '',
) {
  return db()
    .select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      count: sql<number>`(select count(*)::int from collection_files cf join files f on f.id=cf.file_id where cf.collection_id=${collections.id} and f.deleted_at is null and f.upload_status='complete')`,
    })
    .from(collections)
    .where(
      and(
        eq(collections.ownerId, ownerId),
        isNull(collections.deletedAt),
        collectionId ? eq(collections.id, collectionId) : undefined,
        query
          ? sql`${collections.name} ilike ${'%' + query.replace(/[%_\\]/g, '\\$&') + '%'}`
          : undefined,
      ),
    )
    .orderBy(asc(collections.name))
    .limit(100)
    .offset((page - 1) * 100);
}
export async function folderMutation(
  ownerId: string,
  folderId: string,
  action: 'rename' | 'move' | 'trash' | 'restore',
  value?: string | null,
) {
  await db().transaction(async (tx) => {
    await tx.execute(vaultWriteLock);
    const [folder] = await tx
      .select()
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.ownerId, ownerId)));
    if (!folder) throw new ApiError(404, 'NOT_FOUND', 'Folder not found.');
    if (folder.purgeRequestedAt)
      throw new ApiError(
        409,
        'DELETION_IN_PROGRESS',
        'Permanent cleanup has started for this folder.',
      );
    if (action === 'move') {
      const descendants = await tx.execute<{ id: string }>(
        sql`with recursive tree as (select id from folders where id=${folderId} and owner_id=${ownerId} union all select f.id from folders f join tree t on f.parent_id=t.id where f.owner_id=${ownerId}) select id from tree`,
      );
      if (
        wouldCycle(
          folderId,
          value ?? null,
          descendants.rows.map((row) => row.id),
        )
      )
        throw new ApiError(
          409,
          'FOLDER_CYCLE',
          'A folder cannot be moved into itself or its descendants.',
        );
      await checkFolder(ownerId, value ?? null);
      await tx
        .update(folders)
        .set({ parentId: value ?? null, updatedAt: new Date() })
        .where(eq(folders.id, folderId));
    } else if (action === 'rename')
      await tx
        .update(folders)
        .set({ name: value ?? folder.name, updatedAt: new Date() })
        .where(eq(folders.id, folderId));
    else if (action === 'trash') {
      await tx.execute(
        sql`with recursive tree as (select id from folders where id=${folderId} and owner_id=${ownerId} and deleted_at is null union all select f.id from folders f join tree t on f.parent_id=t.id where f.deleted_at is null) update files set deleted_at=now(), deletion_root_id=${folderId} where folder_id in(select id from tree) and deleted_at is null`,
      );
      await tx.execute(
        sql`with recursive tree as (select id from folders where id=${folderId} and owner_id=${ownerId} and deleted_at is null union all select f.id from folders f join tree t on f.parent_id=t.id where f.deleted_at is null) update folders set deleted_at=now(),deletion_root_id=${folderId} where id in(select id from tree)`,
      );
      await tx.execute(
        sql`update share_links set revoked_at=now() where file_id in(select id from files where deletion_root_id=${folderId})`,
      );
    } else {
      const subtree = await tx.execute<{ id: string }>(
        sql`with recursive tree as(select id from folders where id=${folderId} and owner_id=${ownerId} union all select f.id from folders f join tree t on f.parent_id=t.id where f.owner_id=${ownerId}) select id from tree`,
      );
      const restoreIds = subtree.rows.map((row) => row.id);
      const batchRoot = folder.deletionRootId ?? folderId;
      const subtreeScope = and(
        eq(files.ownerId, ownerId),
        eq(files.deletionRootId, batchRoot),
        inArray(files.folderId, restoreIds),
        sql`${files.processingStatus} in ('pending','processing','failed')`,
      );
      await tx.execute(
        sql`insert into processing_jobs(file_id,job_type,generation) select id,'process',processing_version+1 from files where ${subtreeScope}`,
      );
      await tx
        .update(files)
        .set({
          processingStatus: 'pending',
          processingVersion: sql`${files.processingVersion}+1`,
        })
        .where(subtreeScope);
      if (folder.parentId) {
        const [parent] = await tx
          .select()
          .from(folders)
          .where(
            and(eq(folders.id, folder.parentId), isNull(folders.deletedAt)),
          );
        if (!parent)
          await tx
            .update(folders)
            .set({ parentId: null })
            .where(eq(folders.id, folderId));
      }
      await tx
        .update(folders)
        .set({ deletedAt: null, deletionRootId: null })
        .where(
          and(
            eq(folders.ownerId, ownerId),
            inArray(folders.id, restoreIds),
            sql`(${folders.deletionRootId}=${batchRoot} or ${folders.id}=${folderId})`,
            isNull(folders.purgeRequestedAt),
          ),
        );
      await tx
        .update(files)
        .set({ deletedAt: null, deletionRootId: null })
        .where(
          and(
            eq(files.ownerId, ownerId),
            eq(files.deletionRootId, batchRoot),
            inArray(files.folderId, restoreIds),
            sql`${files.processingStatus} != 'deleting'`,
          ),
        );
    }
    await tx
      .insert(activityEvents)
      .values({ ownerId, eventType: `folder_${action}` });
  });
  return { success: true };
}
