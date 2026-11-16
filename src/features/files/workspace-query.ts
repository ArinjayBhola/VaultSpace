import {
  assertFolderAccess,
  FolderLockedError,
  folderScope,
  fileAccessSQL,
  folderParentAccessSQL,
} from '@/lib/folder-access';
import { typeLabel } from '@/lib/file-types';
import { galleryMediaSQL } from './gallery-query';
import 'server-only';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { files, folders, collections, processingJobs } from '@/db/schema';
import { searchFilters } from '@/lib/validation';
import { listFiles, listFolders, listCollections } from './service';
export async function workspaceData(
  ownerId: string,
  query: z.infer<typeof searchFilters>,
) {
  const access = await folderScope(ownerId);
  if (query.folder) {
    try {
      await assertFolderAccess(ownerId, query.folder);
    } catch (error) {
      if (!(error instanceof FolderLockedError)) throw error;
      return {
        files: [],
        folders: [],
        count: 0,
        folderCount: 0,
        collections: [],
        collectionCount: 0,
        currentCollection: null,
        cleanup: null,
        breadcrumbs: [{ id: error.folderId, name: error.folderName }],
        fileTypes: [],
        lockedFolder: { id: error.folderId, name: error.folderName },
        page: query.page,
        limit: query.limit,
        updatedAt: new Date().toISOString(),
      };
    }
  }
  const [
    data,
    folderRows,
    collectionRows,
    [folderTotals],
    [collectionTotals],
    path,
    cleanup,
    currentCollection,
    types,
  ] = await Promise.all([
    listFiles(ownerId, query),
    listFolders(
      ownerId,
      query.folder ?? null,
      query.view === 'trash',
      query.folderPage,
    ),
    listCollections(
      ownerId,
      undefined,
      query.collectionPage,
      query.collectionQuery,
    ),
    db()
      .select({ count: sql<number>`count(*)::int` })
      .from(folders)
      .where(
        and(
          eq(folders.ownerId, ownerId),
          folderParentAccessSQL(access.sessionId),
          query.view === 'trash'
            ? sql`${folders.deletedAt} is not null`
            : isNull(folders.deletedAt),
          query.view === 'trash'
            ? undefined
            : query.folder
              ? eq(folders.parentId, query.folder)
              : isNull(folders.parentId),
        ),
      ),
    db()
      .select({ count: sql<number>`count(*)::int` })
      .from(collections)
      .where(
        and(
          eq(collections.ownerId, ownerId),
          isNull(collections.deletedAt),
          query.collectionQuery
            ? sql`${collections.name} ilike ${'%' + query.collectionQuery.replace(/[%_\\]/g, '\\$&') + '%'}`
            : undefined,
        ),
      ),
    query.folder
      ? db().execute<{ id: string; name: string }>(
          sql`with recursive path as (select id,name,parent_id,0 as depth from folders where id=${query.folder} and owner_id=${ownerId} and deleted_at is null union all select f.id,f.name,f.parent_id,p.depth+1 from folders f join path p on f.id=p.parent_id where f.owner_id=${ownerId}) select id,name from path order by depth desc`,
        )
      : Promise.resolve({ rows: [] }),
    query.view === 'trash'
      ? db()
          .select({ id: processingJobs.id })
          .from(processingJobs)
          .innerJoin(files, eq(files.id, processingJobs.fileId))
          .where(
            and(
              eq(files.ownerId, ownerId),
              eq(processingJobs.jobType, 'delete'),
              eq(processingJobs.status, 'failed'),
              eq(processingJobs.generation, files.processingVersion),
            ),
          )
          .limit(1)
      : Promise.resolve([]),
    query.collection
      ? listCollections(ownerId, query.collection)
      : Promise.resolve([]),
    db()
      .select({
        extension: files.extension,
        mime: files.mimeType,
        count: sql<number>`count(*)::int`,
      })
      .from(files)
      .where(
        and(
          eq(files.ownerId, ownerId),
          eq(files.uploadStatus, 'complete'),
          fileAccessSQL(access.sessionId),
          query.view === 'gallery' ? galleryMediaSQL() : undefined,
          query.view === 'trash'
            ? sql`${files.deletedAt} is not null`
            : isNull(files.deletedAt),
        ),
      )
      .groupBy(files.extension, files.mimeType)
      .orderBy(files.extension),
  ]);
  return {
    ...data,
    fileTypes: Array.from(
      types
        .reduce((map, type) => {
          const value = type.extension || 'mime:' + type.mime;
          const previous = map.get(value);
          map.set(value, {
            value,
            label: typeLabel(type.extension, type.mime),
            count: (previous?.count ?? 0) + type.count,
          });
          return map;
        }, new Map<string, { value: string; label: string; count: number }>())
        .values(),
    ),
    files: data.files.map((file) => ({
      ...file,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      deletedAt: file.deletedAt?.toISOString() ?? null,
      starredAt: file.starredAt?.toISOString() ?? null,
      lastAccessedAt: file.lastAccessedAt?.toISOString() ?? null,
    })),
    folders: folderRows.map((folder) => ({
      ...folder,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
      deletedAt: folder.deletedAt?.toISOString() ?? null,
      purgeRequestedAt: folder.purgeRequestedAt?.toISOString() ?? null,
    })),
    folderCount: folderTotals.count,
    collections: collectionRows,
    collectionCount: collectionTotals.count,
    breadcrumbs: path.rows,
    currentCollection: currentCollection[0] ?? null,
    cleanup:
      query.view === 'trash'
        ? { available: true, failed: cleanup.length > 0 }
        : null,
  };
}
