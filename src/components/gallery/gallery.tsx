'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import * as Menu from '@radix-ui/react-dropdown-menu';
import {
  Images,
  Play,
  LoaderCircle,
  Star,
  MoreVertical,
  Info,
  Download,
  ArrowUpRight,
  Trash2,
  X,
} from 'lucide-react';
import { FileTypeFilter } from '@/components/files/type-filter';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { useFolderAuthorization } from '@/hooks/use-folder-authorization';
import { api, bytes } from '@/lib/client';
import { QUERY_STALE_TIME } from '@/lib/cache-policy';
import { thumbnailUrl } from '@/lib/file-content-url';
import { localDateValue } from '@/lib/time';
import { typeLabel, extensionOf, isGalleryVideo } from '@/lib/file-types';
import { galleryRows } from '@/lib/gallery-layout';
import { MediaLightbox } from '@/components/files/image-lightbox';
import { VideoThumbnail } from '@/components/files/video-thumbnail';
import type { FileResponse, VaultFile } from '@/types';
import './gallery.css';

const FileDetails = dynamic(() =>
  import('@/components/files/details').then((module) => module.FileDetails),
);
const FileSharing = dynamic(() =>
  import('@/components/sharing/file-sharing').then(
    (module) => module.FileSharing,
  ),
);
type FileDialog = { kind: 'preview' | 'details' | 'sharing'; file: VaultFile };

export function Gallery() {
  const [direction, setDirection] = useState('desc');
  const [types, setTypes] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const [starBusy, setStarBusy] = useState<string[]>([]);
  const starRequests = useRef(new Set<string>());
  const [dialog, setDialog] = useState<FileDialog | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [navigationError, setNavigationError] = useState('');
  const navigationRequest = useRef(0);
  const navigationInFlight = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const client = useQueryClient();
  const { authorize, prompt } = useFolderAuthorization();
  const sentinel = useRef<HTMLDivElement>(null);
  const gallery = useRef<HTMLDivElement>(null);
  const [galleryWidth, setGalleryWidth] = useState(0);
  useEffect(() => {
    if (!gallery.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setGalleryWidth(entry.contentRect.width);
    });
    observer.observe(gallery.current);
    return () => observer.disconnect();
  }, []);
  const query = useInfiniteQuery({
    queryKey: ['files', 'gallery', 'media', direction, [...types].sort()],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({
        view: 'gallery',
        sort: 'created',
        direction,
        limit: '100',
        page: String(pageParam),
      });
      for (const type of types) params.append('type', type);
      return api<FileResponse>(
        `/api/files?${params}`,
        undefined,
        'GET',
        signal,
      );
    },
    getNextPageParam: (last) =>
      last.page * last.limit < last.count ? last.page + 1 : undefined,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: dialog?.kind === 'preview' ? false : QUERY_STALE_TIME,
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage, isError } = query;
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasNextPage || isFetchingNextPage || isError || deleting)
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void fetchNextPage();
      },
      { rootMargin: '600px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isError, deleting]);

  const seen = new Set<string>();
  const files = (query.data?.pages.flatMap((page) => page.files) ?? []).filter(
    (file) => {
      if (seen.has(file.id)) return false;
      seen.add(file.id);
      return true;
    },
  );
  const groups = new Map<string, VaultFile[]>();
  for (const file of files) {
    const day = localDateValue(file.createdAt);
    const group = groups.get(day) ?? [];
    group.push(file);
    groups.set(day, group);
  }
  const count = query.data?.pages[0]?.count;
  const previewIndex =
    dialog?.kind === 'preview'
      ? files.findIndex((file) => file.id === dialog.file.id)
      : -1;

  function openPreview(file: VaultFile) {
    navigationRequest.current++;
    navigationInFlight.current = false;
    setNavigating(false);
    setNavigationError('');
    setDialog({ kind: 'preview', file });
  }
  function closeDialog() {
    navigationRequest.current++;
    navigationInFlight.current = false;
    setNavigating(false);
    setNavigationError('');
    setDialog(null);
  }
  async function navigatePreview(step: -1 | 1) {
    if (
      dialog?.kind !== 'preview' ||
      previewIndex < 0 ||
      navigationInFlight.current
    )
      return;
    setNavigationError('');
    const adjacent = files[previewIndex + step];
    if (adjacent) {
      setDialog({ kind: 'preview', file: adjacent });
      return;
    }
    if (step < 0 || !hasNextPage) return;
    const request = ++navigationRequest.current;
    const currentId = dialog.file.id;
    navigationInFlight.current = true;
    setNavigating(true);
    try {
      // Share an existing page request rather than canceling and restarting it.
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await fetchNextPage({ cancelRefetch: false });
        if (request !== navigationRequest.current) return;
        if (result.isError) throw result.error;
        const ids = new Set<string>();
        const loaded = (
          result.data?.pages.flatMap((page) => page.files) ?? []
        ).filter((file) => {
          if (ids.has(file.id)) return false;
          ids.add(file.id);
          return true;
        });
        const index = loaded.findIndex((file) => file.id === currentId);
        if (index >= 0 && loaded[index + 1]) {
          setDialog({ kind: 'preview', file: loaded[index + 1] });
          break;
        }
        if (!result.hasNextPage) break;
      }
    } catch (cause) {
      if (request === navigationRequest.current)
        setNavigationError(
          cause instanceof Error
            ? cause.message
            : 'Could not load the next item. Try the right arrow again.',
        );
    } finally {
      if (request === navigationRequest.current) {
        navigationInFlight.current = false;
        setNavigating(false);
      }
    }
  }

  async function refresh() {
    await Promise.all(
      ['files', 'analytics', 'activity', 'shares', 'file-details'].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    );
  }
  async function toggleStar(file: VaultFile) {
    if (deleteMode || starRequests.current.has(file.id)) return;
    starRequests.current.add(file.id);
    setStarBusy((previous) => [...previous, file.id]);
    setError('');
    try {
      await authorize(() =>
        api('/api/files', {
          operation: 'bulk',
          ids: [file.id],
          action: file.starredAt ? 'unstar' : 'star',
        }),
      );
      client.setQueriesData<InfiniteData<FileResponse>>(
        { queryKey: ['files', 'gallery'] },
        (data) =>
          data
            ? {
                ...data,
                pages: data.pages.map((page) => ({
                  ...page,
                  files: page.files.map((item) =>
                    item.id === file.id
                      ? {
                          ...item,
                          starredAt: file.starredAt
                            ? null
                            : new Date().toISOString(),
                        }
                      : item,
                  ),
                })),
              }
            : data,
      );
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not update favourite.',
      );
    } finally {
      starRequests.current.delete(file.id);
      setStarBusy((previous) => previous.filter((id) => id !== file.id));
    }
  }
  function toggleSelection(id: string) {
    if (deletingRef.current) return;
    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  }
  function cancelDeleteMode() {
    if (deletingRef.current) return;
    setDeleteMode(false);
    setSelected([]);
    setConfirmDelete(false);
  }
  async function deleteSelected() {
    if (deletingRef.current || !selected.length) return;
    deletingRef.current = true;
    setDeleting(true);
    setConfirmDelete(false);
    setError('');
    setNotice('');
    const ids = [...selected];
    let completed = 0;
    try {
      // The existing file API accepts up to 100 IDs per transaction.
      for (let offset = 0; offset < ids.length; offset += 100) {
        const batch = ids.slice(offset, offset + 100);
        await authorize(() =>
          api('/api/files', { operation: 'bulk', ids: batch, action: 'trash' }),
        );
        completed += batch.length;
        setSelected((previous) => previous.filter((id) => !batch.includes(id)));
      }
      setDeleteMode(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not delete selected files.',
      );
    } finally {
      if (completed) {
        setNotice(
          `${completed} ${completed === 1 ? 'file moved' : 'files moved'} to Trash.`,
        );
        await refresh();
      }
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  return (
    <div className="gallery-page" ref={gallery}>
      <header className="gallery-heading">
        <div>
          <h1>
            Gallery<span className="gallery-title-dot">.</span>
          </h1>
          <p>Your photos and videos, one day at a time.</p>
        </div>
        {count !== undefined && (
          <span className="gallery-total">
            {count.toLocaleString()} {count === 1 ? 'item' : 'items'}
          </span>
        )}
      </header>
      <div className="gallery-filters" aria-label="Gallery filters">
        <Select
          aria-label="Gallery date order"
          value={direction}
          disabled={deleting}
          onChange={(event) => {
            setDirection(event.target.value);
            setSelected([]);
          }}
        >
          <option value="desc">New to old</option>
          <option value="asc">Old to new</option>
        </Select>
        <div
          className={deleting ? 'gallery-disabled-filter' : undefined}
          inert={deleting}
        >
          <FileTypeFilter
            allLabel="All photos & videos"
            options={query.data?.pages[0]?.fileTypes ?? []}
            value={types}
            onChange={(value) => {
              setTypes(value);
              setSelected([]);
            }}
          />
        </div>
        <div className="gallery-delete-controls">
          {deleteMode ? (
            <>
              <span className="gallery-selected-count" role="status">
                {selected.length} selected
              </span>
              <button
                type="button"
                className="btn danger"
                disabled={!selected.length || deleting}
                onClick={() => setConfirmDelete(true)}
              >
                {deleting ? (
                  <LoaderCircle size={15} className="vault-spinner" />
                ) : (
                  <Trash2 size={15} />
                )}
                Delete{selected.length ? ` (${selected.length})` : ''}
              </button>
              <button
                type="button"
                className="btn"
                disabled={deleting}
                onClick={cancelDeleteMode}
              >
                <X size={15} />
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn"
              aria-pressed={false}
              onClick={() => {
                setDeleteMode(true);
                closeDialog();
                setNotice('');
              }}
            >
              <Trash2 size={15} />
              Delete
            </button>
          )}
        </div>
      </div>
      {deleteMode && (
        <p className="gallery-selection-hint">
          Select the files you want to delete. They will be moved to Trash.
        </p>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button
            type="button"
            className="icon-btn"
            aria-label="Dismiss error"
            onClick={() => setError('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
          <Link href="/trash" className="link">
            View Trash
          </Link>
          <button
            type="button"
            className="icon-btn"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {query.isPending && (
        <div
          className="gallery-grid gallery-loading"
          role="status"
          aria-label="Loading gallery"
        >
          {Array.from({ length: 18 }, (_, i) => (
            <div className="skeleton gallery-skeleton" key={i} />
          ))}
        </div>
      )}
      {query.isError && (
        <div className="notice error" role="alert">
          {query.error.message}
          <button
            type="button"
            className="btn"
            onClick={() =>
              void (query.hasNextPage ? query.fetchNextPage() : query.refetch())
            }
          >
            Retry
          </button>
        </div>
      )}
      {!query.isPending && !query.isError && !files.length && (
        <div className="gallery-empty">
          <div className="gallery-empty-icon">
            <Images size={32} strokeWidth={1.3} />
          </div>
          <h2>
            {types.length
              ? 'Nothing in this frame'
              : 'Your gallery starts here'}
          </h2>
          <p>
            {types.length
              ? 'Try another file type to find your photos and videos.'
              : 'Your photo and video uploads will appear here, arranged by date.'}
          </p>
        </div>
      )}
      {Array.from(groups, ([day, items], groupIndex) => (
        <section
          className="gallery-day"
          key={day}
          aria-labelledby={`day-${day}`}
        >
          <div className="gallery-day-heading">
            <h2 id={`day-${day}`}>{dayHeading(day)}</h2>
            <span>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="gallery-rows">
            {galleryRows(items, galleryWidth).map((row, rowIndex) => (
              <div className="gallery-photo-row" key={row.files[0].id}>
                {row.files.map((file, index) => (
                  <GalleryTile
                    key={file.id}
                    file={file}
                    eager={groupIndex === 0 && rowIndex === 0}
                    style={{ width: row.widths[index], height: row.height }}
                    deleteMode={deleteMode}
                    selected={selected.includes(file.id)}
                    disabled={deleting}
                    starBusy={starBusy.includes(file.id)}
                    onSelect={() => toggleSelection(file.id)}
                    onPreview={() => openPreview(file)}
                    onDetails={() => setDialog({ kind: 'details', file })}
                    onStar={() => void toggleStar(file)}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
      <div ref={sentinel} className="gallery-sentinel">
        {query.isFetchingNextPage && (
          <span role="status">
            <LoaderCircle size={18} className="vault-spinner" /> Loading more…
          </span>
        )}
        {query.hasNextPage && !query.isFetchingNextPage && !query.isError && (
          <button
            className="btn"
            type="button"
            disabled={deleting}
            onClick={() => void query.fetchNextPage()}
          >
            Load more
          </button>
        )}
      </div>
      <Dialog
        open={Boolean(dialog && dialog.kind !== 'preview')}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
        title={
          dialog?.kind === 'details'
            ? 'File details'
            : dialog?.kind === 'sharing'
              ? 'Sharing details'
              : (dialog?.file.displayName ?? 'Preview')
        }
        description={
          dialog
            ? `${bytes(dialog.file.sizeBytes)} · ${dialog.kind === 'preview' ? 'File preview' : dialog.file.displayName}`
            : ''
        }
      >
        {dialog?.kind === 'details' && (
          <FileDetails
            key={dialog.file.id}
            file={dialog.file}
            onShare={(file) => setDialog({ kind: 'sharing', file })}
          />
        )}
        {dialog?.kind === 'sharing' && (
          <FileSharing
            fileId={dialog.file.id}
            name={dialog.file.displayName}
            folderProtected={dialog.file.folderProtected}
          />
        )}
      </Dialog>
      {dialog?.kind === 'preview' && (
        <MediaLightbox
          url={`/api/files/${dialog.file.id}/content${isGalleryVideo(dialog.file.originalFilename, dialog.file.mimeType) ? '?media=1' : ''}`}
          name={dialog.file.displayName}
          video={isGalleryVideo(
            dialog.file.originalFilename,
            dialog.file.mimeType,
          )}
          mimeType={dialog.file.mimeType}
          downloadUrl={`/api/files/${dialog.file.id}/download`}
          onClose={closeDialog}
          navigation={{
            onPrevious: () => void navigatePreview(-1),
            onNext: () => void navigatePreview(1),
            hasPrevious: previewIndex > 0,
            hasNext:
              previewIndex >= 0 &&
              (previewIndex < files.length - 1 || Boolean(hasNextPage)),
            busy: navigating,
            error: navigationError,
          }}
        />
      )}
      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selected.length === 1 ? 'this file' : `${selected.length} files`}?`}
        description="Selected files will be moved to Trash. You can restore them from there."
      >
        <div className="dialog-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={deleting || !selected.length}
            onClick={() => void deleteSelected()}
          >
            <Trash2 size={15} />
            Move to Trash
          </button>
        </div>
      </Dialog>
      {prompt}
    </div>
  );
}

function dayHeading(day: string) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === localDateValue(today)) return 'Today';
  if (day === localDateValue(yesterday)) return 'Yesterday';
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(new Date(`${day}T00:00:00`).getFullYear() !== today.getFullYear()
      ? { year: 'numeric' as const }
      : {}),
  });
}

type TileProps = {
  file: VaultFile;
  eager: boolean;
  style: CSSProperties;
  deleteMode: boolean;
  selected: boolean;
  disabled: boolean;
  starBusy: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onDetails: () => void;
  onStar: () => void;
};
function GalleryTile({
  file,
  eager,
  style,
  deleteMode,
  selected,
  disabled,
  starBusy,
  onSelect,
  onPreview,
  onDetails,
  onStar,
}: TileProps) {
  const [failedSource, setFailedSource] = useState('');
  const video = isGalleryVideo(file.originalFilename, file.mimeType);
  const source = file.hasThumbnail
    ? thumbnailUrl(file)
    : !video && file.sizeBytes <= 20 * 1024 * 1024
      ? `/api/files/${file.id}/content`
      : '';
  const label = typeLabel(extensionOf(file.originalFilename), file.mimeType);
  const path = `/files/${file.id}`;
  return (
    <article
      style={style}
      className={`gallery-tile ${video ? 'is-video' : 'is-image'} ${deleteMode ? 'is-selecting' : ''} ${selected ? 'is-selected' : ''}`}
    >
      <div className="gallery-tile-visual" aria-hidden="true">
        {video ? (
          <VideoThumbnail file={file} />
        ) : source && failedSource !== source ? (
          <Image
            src={source}
            alt=""
            fill
            unoptimized
            loading={eager ? 'eager' : 'lazy'}
            sizes="(max-width: 480px) 33vw, (max-width: 700px) 25vw, 17vw"
            onError={() => setFailedSource(source)}
          />
        ) : (
          <div className="gallery-file-art">
            <Images size={38} strokeWidth={1.25} />
            <span>{label}</span>
          </div>
        )}
      </div>
      {video && (
        <span className="gallery-video-badge">
          <Play size={12} fill="currentColor" />
          {label}
        </span>
      )}
      {deleteMode ? (
        <label className="gallery-select-target">
          <input
            type="checkbox"
            checked={selected}
            disabled={disabled}
            onChange={onSelect}
            aria-label={`Select ${file.displayName} for deletion`}
          />
        </label>
      ) : (
        <button
          type="button"
          className="gallery-preview-target"
          onClick={onPreview}
          aria-label={`Preview ${file.displayName}`}
          title={file.displayName}
        />
      )}
      <div className="gallery-tile-caption">
        <span>{file.displayName}</span>
      </div>
      {!deleteMode && (
        <div className="gallery-card-actions">
          <Tooltip
            label={file.starredAt ? 'Remove favourite' : 'Add to favourites'}
          >
            <button
              type="button"
              className={`icon-btn ${file.starredAt ? 'is-favourite' : ''}`}
              aria-label={
                file.starredAt
                  ? `Remove ${file.displayName} from favourites`
                  : `Add ${file.displayName} to favourites`
              }
              aria-pressed={Boolean(file.starredAt)}
              disabled={starBusy}
              onClick={onStar}
            >
              {starBusy ? (
                <LoaderCircle size={15} className="vault-spinner" />
              ) : (
                <Star
                  size={15}
                  fill={file.starredAt ? 'currentColor' : 'none'}
                />
              )}
            </button>
          </Tooltip>
          <Menu.Root>
            <Tooltip label="File options">
              <Menu.Trigger
                className="icon-btn"
                aria-label={`Options for ${file.displayName}`}
              >
                <MoreVertical size={16} />
              </Menu.Trigger>
            </Tooltip>
            <Menu.Portal>
              <Menu.Content
                className="menu-content"
                align="end"
                sideOffset={7}
                collisionPadding={12}
              >
                <Menu.Item className="menu-item" onSelect={onDetails}>
                  <Info size={14} />
                  File details
                </Menu.Item>
                <Menu.Item className="menu-item" asChild>
                  <a href={`/api/files/${file.id}/download`}>
                    <Download size={14} />
                    Download
                  </a>
                </Menu.Item>
                <Menu.Item className="menu-item" asChild>
                  <Link href={path} prefetch={false}>
                    <ArrowUpRight size={14} />
                    Open file
                  </Link>
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      )}
    </article>
  );
}
