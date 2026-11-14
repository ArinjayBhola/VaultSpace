'use client';

import { Tooltip } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Layers3, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/client';
import type { FileResponse } from '@/types';
export function CollectionPicker({
  value,
  onChange,
  allowNone = false,
}: {
  value: string;
  onChange: (id: string) => void;
  allowNone?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, error, isPending } = useQuery({
    queryKey: ['collection-picker', page, query],
    queryFn: () =>
      api<FileResponse>(
        `/api/files?limit=1&collectionPage=${page}&collectionQuery=${encodeURIComponent(query)}`,
      ),
  });
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, margin: '18px 0' }}>
        <Input
          aria-label="Find collections"
          placeholder="Find a collection…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Tooltip label="Search collections">
          <button
            className="btn"
            type="button"
            aria-label="Search collections"
            onClick={() => {
              setQuery(q);
              setPage(1);
            }}
          >
            <Search size={15} />
          </button>
        </Tooltip>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error.message}
        </p>
      )}
      <div className="card" style={{ maxHeight: 220, overflow: 'auto' }}>
        {allowNone && (
          <label className="menu-item">
            <Input
              type="radio"
              name="collection-choice"
              checked={!value}
              onChange={() => onChange('')}
            />
            All collections
          </label>
        )}
        {isPending ? (
          <p className="muted" style={{ padding: 12 }}>
            Loading…
          </p>
        ) : (
          data?.collections.map((collection) => (
            <label className="menu-item" key={collection.id}>
              <Input
                type="radio"
                name="collection-choice"
                checked={value === collection.id}
                onChange={() => onChange(collection.id)}
              />
              <Layers3 size={16} color="#8b5cf6" />
              {collection.name}
              <span
                className="muted"
                style={{
                  marginLeft: 'auto',
                  fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                }}
              >
                {collection.count}
              </span>
            </label>
          ))
        )}
        {data && !data.collections.length && (
          <p
            className="muted"
            style={{
              fontSize: 'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
              padding: 15,
            }}
          >
            No matching collections.{' '}
            <Link href="/collections" className="link">
              Create a collection
            </Link>{' '}
            first.
          </p>
        )}
      </div>
      <div className="pagination" style={{ marginTop: 10 }}>
        <span>{data?.collectionCount ?? '…'} collections</span>
        <div>
          <Tooltip label="Previous collections">
            <button
              className="icon-btn"
              type="button"
              aria-label="Previous collections"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={15} />
            </button>
          </Tooltip>
          <Tooltip label="More collections">
            <button
              className="icon-btn"
              type="button"
              aria-label="More collections"
              disabled={page * 100 >= (data?.collectionCount ?? 0)}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
