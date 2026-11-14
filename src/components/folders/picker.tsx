'use client';

import { Tooltip } from '@/components/ui/tooltip';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Folder, ChevronRight, ChevronLeft } from 'lucide-react';
import { api } from '@/lib/client';
import type { FileResponse } from '@/types';
export function FolderPicker({
  onChange,
  exclude,
  value = '',
  label = 'Destination folder',
}: {
  onChange: (id: string) => void;
  exclude?: string;
  value?: string;
  label?: string;
}) {
  const [browse, setBrowse] = useState(value);
  const [page, setPage] = useState(1);
  const { data, error, isPending } = useQuery({
    queryKey: ['folder-picker', browse, page],
    queryFn: () =>
      api<FileResponse>(
        `/api/files?view=root&limit=1&folderPage=${page}${browse ? `&folder=${browse}` : ''}`,
      ),
  });
  function choose(id: string) {
    setBrowse(id);
    setPage(1);
    onChange(id);
  }
  return (
    <div>
      <div className="form-field">
        {label}
        <div
          style={{
            display: 'flex',
            gap: 4,
            alignItems: 'center',
            flexWrap: 'wrap',
            fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
          }}
        >
          <button className="tab" type="button" onClick={() => choose('')}>
            My files
          </button>
          {data?.breadcrumbs.map((b) => (
            <span
              key={b.id}
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <ChevronRight size={12} />
              <button
                className="tab"
                type="button"
                onClick={() => choose(b.id)}
              >
                {b.name}
              </button>
            </span>
          ))}
        </div>
      </div>
      <div
        className="card"
        style={{ maxHeight: 230, overflow: 'auto', padding: 5 }}
      >
        {isPending ? (
          <p className="muted" style={{ padding: 10 }}>
            Loading folders…
          </p>
        ) : error ? (
          <p className="danger" role="alert">
            {error.message}
          </p>
        ) : data?.folders.length ? (
          data.folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className="menu-item"
              disabled={folder.id === exclude}
              style={{
                width: '100%',
                background: 'transparent',
                border: 0,
                textAlign: 'left',
              }}
              onClick={() => choose(folder.id)}
            >
              <Folder size={17} color="#d6a843" />
              {folder.name}
              <ChevronRight size={13} style={{ marginLeft: 'auto' }} />
            </button>
          ))
        ) : (
          <p
            className="muted"
            style={{
              padding: 10,
              fontSize: 'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
            }}
          >
            No subfolders. Files will move into the folder shown above.
          </p>
        )}
      </div>
      <div className="pagination" style={{ marginTop: 8 }}>
        <span>Selected: {data?.breadcrumbs.at(-1)?.name ?? 'My files'}</span>
        <div>
          <Tooltip label="Previous folders">
            <button
              className="icon-btn"
              type="button"
              aria-label="Previous folders"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={14} />
            </button>
          </Tooltip>
          <Tooltip label="More folders">
            <button
              className="icon-btn"
              type="button"
              aria-label="More folders"
              disabled={(data?.folderCount ?? 0) <= page * 100}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={14} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
