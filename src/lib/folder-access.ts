import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { ownerSession, ApiError } from './auth';
type Scope = { ownerId: string; sessionId: string; expiresAt: Date };
const scopeStore = new AsyncLocalStorage<{ scope?: Promise<Scope> }>();
export function withFolderScope<T>(callback: () => Promise<T>) {
  return scopeStore.run({}, callback);
}
export async function folderScope(ownerId: string) {
  const context = scopeStore.getStore();
  const load = async () => {
    const current = await ownerSession();
    if (current.user.id !== ownerId)
      throw new ApiError(403, 'FORBIDDEN', 'Folder access denied.');
    return {
      ownerId,
      sessionId: current.session.id,
      expiresAt: current.session.expiresAt,
    };
  };
  const result = context ? (context.scope ??= load()) : load();
  return result;
}
export class FolderLockedError extends ApiError {
  constructor(
    public folderId: string,
    public folderName: string,
  ) {
    super(
      423,
      'FOLDER_LOCKED',
      'Unlock the protected folder to access its contents.',
    );
  }
}
export function fileAccessSQL(sessionId: string, table = 'files') {
  return sql`vault_folder_access(${sql.identifier(table)}.${sql.identifier('folder_id')},${sessionId})`;
}
export function folderParentAccessSQL(sessionId: string) {
  return sql`vault_folder_access(${sql.identifier('folders')}.${sql.identifier('parent_id')},${sessionId})`;
}
export async function assertFolderAccess(
  ownerId: string,
  folderId: string | null,
) {
  if (!folderId) return;
  const scope = await folderScope(ownerId);
  const result = await db().execute<{ id: string; name: string }>(
    sql`with recursive path as(select id,name,parent_id,password_hash,0 as depth from folders where id=${folderId} and owner_id=${ownerId} union all select p.id,p.name,p.parent_id,p.password_hash,c.depth+1 from folders p join path c on c.parent_id=p.id where p.owner_id=${ownerId}) select id,name from path p where password_hash is not null and not exists(select 1 from folder_unlocks u where u.folder_id=p.id and u.session_id=${scope.sessionId} and u.expires_at>now()) order by depth desc limit 1`,
  );
  const locked = result.rows[0];
  if (locked) throw new FolderLockedError(locked.id, locked.name);
}
export async function assertTreeAccess(ownerId: string, folderId: string) {
  const scope = await folderScope(ownerId);
  const result = await db().execute<{ id: string; name: string }>(
    sql`with recursive tree as(select id,name from folders where id=${folderId} and owner_id=${ownerId} union all select f.id,f.name from folders f join tree t on f.parent_id=t.id where f.owner_id=${ownerId}) select id,name from tree where not vault_folder_access(id,${scope.sessionId}) limit 1`,
  );
  const locked = result.rows[0];
  if (locked) throw new FolderLockedError(locked.id, locked.name);
}
export async function folderProtected(folderId: string | null) {
  if (!folderId) return false;
  const result = await db().execute<{ protected: boolean }>(
    sql`select vault_folder_protected(${folderId}::uuid) as protected`,
  );
  return result.rows[0]?.protected ?? false;
}
