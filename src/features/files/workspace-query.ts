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
  const [
    data,
    folderRows,
    collectionRows,
    [folderTotals],
    [collectionTotals],
    path,
    cleanup,
    currentCollection,
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
  ]);
  return {
    ...data,
    files: data.files.map((file) => ({
      ...file,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
      deletedAt: file.deletedAt?.toISOString() ?? null,
      starredAt: file.starredAt?.toISOString() ?? null,
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
