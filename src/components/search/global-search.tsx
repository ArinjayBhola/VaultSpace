'use client';

import { Tooltip } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  FileText,
  ImageIcon,
  X,
  LoaderCircle,
  ArrowUpRight,
} from 'lucide-react';
import { api } from '@/lib/client';
import type { VaultFile } from '@/types';
export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key === 'k' &&
        !document.querySelector('[aria-modal="true"]')
      ) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const { data, error, isFetching } = useQuery({
    queryKey: ['suggestions', debounced],
    queryFn: ({ signal }) =>
      api<{
        files: Pick<
          VaultFile,
          'id' | 'displayName' | 'mimeType' | 'sizeBytes'
        >[];
      }>(
        `/api/search/suggestions?q=${encodeURIComponent(debounced)}`,
        undefined,
        'GET',
        signal,
      ),
    enabled: open && debounced.length > 1,
  });
  function choose(i: number) {
    const file = data?.files[i];
    setOpen(false);
    if (file)
      router.push(
        file.mimeType === 'application/pdf'
          ? `/documents/${file.id}`
          : `/files/${file.id}`,
      );
    else router.push(`/search?q=${encodeURIComponent(q)}`);
  }
  return (
    <form
      className="global-search"
      role="search"
      style={{ position: 'relative' }}
      onSubmit={(e) => {
        e.preventDefault();
        choose(index);
      }}
    >
      {isFetching ? (
        <LoaderCircle
          size={18}
          className="vault-spinner"
          aria-label="Searching"
        />
      ) : (
        <Search size={18} />
      )}
      <Input
        ref={input}
        role="combobox"
        aria-label="Search your vault"
        aria-expanded={open && debounced.length > 1}
        aria-controls="search-suggestions"
        aria-autocomplete="list"
        aria-activedescendant={
          index >= 0 ? `search-result-${index}` : undefined
        }
        placeholder="Search by file name or type…"
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setIndex(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex((prev) =>
              Math.min((data?.files.length ?? 0) - 1, prev + 1),
            );
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex((prev) => Math.max(-1, prev - 1));
          }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {q && (
        <Tooltip label="Clear search">
          <button
            type="button"
            className="icon-btn search-clear"
            aria-label="Clear search"
            onClick={() => {
              setQ('');
              setIndex(-1);
              setOpen(false);
              input.current?.focus();
            }}
          >
            <X size={14} />
          </button>
        </Tooltip>
      )}
      <kbd className="keycap">⌘ / Ctrl K</kbd>
      {open && debounced.length > 1 && (
        <div
          id="search-suggestions"
          role="listbox"
          className="menu-content search-suggestion-panel"
          style={{
            position: 'absolute',
            top: 47,
            left: 0,
            right: 0,
            color: 'var(--text)',
          }}
        >
          <div className="search-suggestion-heading">
            Search your vault <span>Files &amp; PDF text</span>
          </div>
          {isFetching && (
            <p
              className="muted"
              style={{
                fontSize: 'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
                padding: 10,
                margin: 0,
              }}
            >
              Searching…
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="danger"
              style={{
                fontSize: 'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
                padding: 10,
                margin: 0,
              }}
            >
              {error.message}
            </p>
          )}
          {data?.files.map((file, i) => (
            <button
              type="button"
              id={`search-result-${i}`}
              role="option"
              aria-selected={index === i}
              key={file.id}
              className="menu-item"
              style={{
                width: '100%',
                border: 0,
                textAlign: 'left',
                background: index === i ? 'var(--soft)' : 'transparent',
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              {file.mimeType === 'application/pdf' ? (
                <FileText size={16} />
              ) : (
                <ImageIcon size={16} />
              )}
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.displayName}
              </span>
            </button>
          ))}
          {data && !data.files.length && (
            <p
              className="muted"
              style={{
                fontSize: 'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
                padding: 10,
                margin: 0,
              }}
            >
              No matching files.
            </p>
          )}
          <button
            type="submit"
            className="menu-item"
            style={{
              width: '100%',
              background: 'var(--soft)',
              color: 'var(--blue)',
              border: 0,
            }}
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
              router.push(`/search?q=${encodeURIComponent(q)}`);
            }}
          >
            See all matching files{' '}
            <ArrowUpRight size={14} style={{ marginLeft: 'auto' }} />
          </button>
        </div>
      )}
    </form>
  );
}
