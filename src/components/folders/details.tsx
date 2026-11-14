'use client';
import { useQuery } from '@tanstack/react-query';
import { Folder } from 'lucide-react';
import type { VaultFolder, FileResponse } from '@/types';
import { api, date } from '@/lib/client';
export function FolderDetails({ folder }: { folder: VaultFolder }) {
  const { data, error } = useQuery({
    queryKey: ['folder-details', folder.id],
    queryFn: () =>
      api<FileResponse>(`/api/files?folder=${folder.id}&view=root&limit=1`),
  });
  return (
    <>
      <Folder size={42} color="#d6a843" style={{ margin: '20px 0' }} />
      <h3>{folder.name}</h3>
      <p
        className="muted"
        style={{
          fontSize: 'max(9px, calc(14px * var(--vault-font-scale, 1)))',
          lineHeight: 1.8,
        }}
      >
        {folder.description || 'No description added.'}
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error.message}
        </p>
      )}
      <dl
        style={{
          fontSize: 'max(9px, calc(14px * var(--vault-font-scale, 1)))',
          lineHeight: 2.3,
        }}
      >
        {[
          ['Created', date(folder.createdAt)],
          ['Modified', date(folder.updatedAt)],
          ['Direct files', data?.count ?? 'Loading…'],
          ['Subfolders', data?.folderCount ?? 'Loading…'],
        ].map(([key, value]) => (
          <div
            key={key}
            style={{ display: 'flex', justifyContent: 'space-between' }}
          >
            <dt className="muted">{key}</dt>
            <dd style={{ margin: 0 }}>{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
