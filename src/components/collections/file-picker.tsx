'use client';

import { Tooltip } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  ImageIcon,
} from 'lucide-react';
import { api, bytes } from '@/lib/client';
import type { FileResponse } from '@/types';
export function CollectionFilePicker({
  collectionId,
  onDone,
}: {
  collectionId: string;
  onDone: () => void;
}) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const {
    data,
    isPending,
    error: loadError,
  } = useQuery({
    queryKey: ['collection-file-picker', page, search],
    queryFn: () =>
      api<FileResponse>(
        `/api/files?view=all&limit=12&page=${page}&q=${encodeURIComponent(search)}`,
      ),
  });
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api('/api/files', {
        operation: 'collection-membership',
        collectionId,
        ids,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add files.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form
        style={{ display: 'flex', gap: 8, margin: '18px 0' }}
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q);
          setPage(1);
        }}
      >
        <Input
          aria-label="Find existing files"
          placeholder="Search existing files…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Tooltip label="Search existing files">
          <button className="btn" aria-label="Search existing files">
            <Search size={16} />
          </button>
        </Tooltip>
      </form>
      {loadError && (
        <p role="alert" className="notice error">
          {loadError.message}
        </p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div className="card" style={{ maxHeight: 300, overflow: 'auto' }}>
        {isPending ? (
          <p className="muted" style={{ padding: 15 }}>
            Loading your files…
          </p>
        ) : data?.files.length ? (
          data.files.map((file) => (
            <label
              key={file.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: 12,
                borderBottom: '1px solid var(--border)',
                fontSize: 'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
              }}
            >
              <Input
                type="checkbox"
                checked={ids.includes(file.id)}
                onChange={(e) => {
                  if (e.target.checked && ids.length >= 100) {
                    setError('Add up to 100 files at a time.');
                    return;
                  }
                  setIds((previous) =>
                    e.target.checked
                      ? [...previous, file.id]
                      : previous.filter((id) => id !== file.id),
                  );
                }}
              />
              {file.mimeType === 'application/pdf' ? (
                <FileText size={17} color="#e38579" />
              ) : (
                <ImageIcon size={17} color="#7aa4d5" />
              )}
              <span
                style={{
                  minWidth: 0,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.displayName}
              </span>
              <span className="muted">{bytes(file.sizeBytes)}</span>
            </label>
          ))
        ) : (
          <div className="empty">
            <p>No matching files. Upload files into My files first.</p>
          </div>
        )}
      </div>
      <div className="pagination">
        <span>{ids.length} selected across pages</span>
        <div>
          <Tooltip label="Previous files">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous files"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} />
            </button>
          </Tooltip>
          <Tooltip label="Next files">
            <button
              type="button"
              className="icon-btn"
              aria-label="Next files"
              disabled={page * 12 >= (data?.count ?? 0)}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="dialog-actions">
        <button
          className="btn primary"
          disabled={!ids.length || busy}
          onClick={() => void save()}
        >
          {busy ? 'Adding…' : `Add ${ids.length || ''} files`}
        </button>
      </div>
    </>
  );
}
