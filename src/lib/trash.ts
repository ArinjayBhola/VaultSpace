import {
  folderScope as accessScope,
  assertFolderAccess,
  assertTreeAccess,
} from './folder-access';
import { vaultWriteLock } from '@/db/lock';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { ApiError } from './auth';
export async function emptyTrash(ownerId: string, folderId?: string) {
  const access = await accessScope(ownerId);
  if (folderId) {
    await assertFolderAccess(ownerId, folderId);
    await assertTreeAccess(ownerId, folderId);
  }
  return db().transaction(async (tx) => {
    await tx.execute(vaultWriteLock);
    if (folderId) {
      const folder = await tx.execute(
        sql`select id from folders where id=${folderId} and owner_id=${ownerId} and deleted_at is not null`,
      );
      if (!folder.rows.length)
        throw new ApiError(
          409,
          'NOT_TRASHED',
          'Move this folder to trash before permanently deleting it.',
        );
    }
    const scope = folderId
      ? sql`and (folder_id in (with recursive tree as(select id from folders where id=${folderId} and owner_id=${ownerId} union all select f.id from folders f join tree t on f.parent_id=t.id) select id from tree))`
      : sql``;
    const available = sql`and vault_folder_access(files.folder_id,${access.sessionId}) and not exists(select 1 from processing_jobs j where j.file_id=files.id and j.job_type='delete' and j.generation=files.processing_version and j.status in ('pending','running'))`;
    const queued = await tx.execute(
      sql`insert into processing_jobs(file_id,job_type,generation) select id,'delete',processing_version+1 from files where owner_id=${ownerId} and deleted_at is not null ${scope} ${available} returning id`,
    );
    await tx.execute(
      sql`update files set processing_status='deleting',processing_version=processing_version+1 where owner_id=${ownerId} and deleted_at is not null ${scope} ${available}`,
    );
    const folderScope = folderId
      ? sql`and id in(with recursive tree as(select id from folders where id=${folderId} and owner_id=${ownerId} union all select f.id from folders f join tree t on f.parent_id=t.id) select id from tree)`
      : sql``;
    await tx.execute(
      sql`update folders set purge_requested_at=now() where owner_id=${ownerId} and deleted_at is not null and vault_folder_access(id,${access.sessionId}) and not exists(with recursive descendants as(select c.id from folders c where c.parent_id=folders.id union all select c.id from folders c join descendants d on c.parent_id=d.id) select 1 from descendants where not vault_folder_access(id,${access.sessionId})) ${folderScope}`,
    );
    // Empty folders do not need an object-storage job; remove leaves immediately.
    for (let pass = 0; pass < 100; pass++) {
      const removed = await tx.execute(
        sql`delete from folders f where f.owner_id=${ownerId} and f.purge_requested_at is not null and not exists(select 1 from files x where x.folder_id=f.id) and not exists(select 1 from folders c where c.parent_id=f.id) returning f.id`,
      );
      if (!removed.rows.length) break;
    }
    return {
      success: true,
      queuedFiles: queued.rows.length,
      message: queued.rows.length
        ? 'Permanent cleanup queued. Objects remain tracked until R2 deletion succeeds.'
        : 'Cleanup is already running, or no files need cleanup. Empty folders are removed as cleanup completes.',
    };
  });
}
