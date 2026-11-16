/* eslint-disable @next/next/no-img-element -- Private previews require browser credentials; R2 thumbnails are already resized. */
'use client';
import { useDateFormatter } from '@/hooks/use-date-formatter';
import { useFolderAuthorization } from '@/hooks/use-folder-authorization';
import { FolderUnlock } from '@/components/folders/unlock';
import dynamic from 'next/dynamic';
import { splitFileName, withFileExtension } from '@/lib/file-name';
import { defaultShareExpiry } from '@/lib/time';
import { typeLabel, extensionOf, isGalleryVideo } from '@/lib/file-types';
import { VideoThumbnail } from '@/components/files/video-thumbnail';
import { fileQuery } from '@/lib/file-query';
import { QUERY_STALE_TIME } from '@/lib/cache-policy';
import { thumbnailUrl } from '@/lib/file-content-url';

import { FileTypeFilter } from '@/components/files/type-filter';
import { EditableFileName } from '@/components/files/editable-file-name';
import { PasswordInput } from '@/components/ui/password-input';
import { Tooltip } from '@/components/ui/tooltip';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DateTimePicker } from '@/components/ui/date-picker';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { motion } from 'motion/react';
import {
  Upload,
  Plus,
  FolderPlus,
  Folder,
  Grid2X2,
  List,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  FileText,
  ImageIcon,
  Star,
  Download,
  Pencil,
  FolderInput,
  Link2,
  Trash2,
  Info,
  Layers3,
  RotateCcw,
  Search,
  X,
  Check,
  ShieldCheck,
  ArrowUpRight,
  RefreshCw,
  LockKeyhole,
} from 'lucide-react';
import { api, bytes } from '@/lib/client';
import type { VaultFile, VaultFolder, FileResponse, Collection } from '@/types';
import { Dialog } from '@/components/ui/dialog';
const CollectionPicker = dynamic(() =>
  import('@/components/collections/picker').then(
    (module) => module.CollectionPicker,
  ),
);
const CollectionFilePicker = dynamic(() =>
  import('@/components/collections/file-picker').then(
    (module) => module.CollectionFilePicker,
  ),
);
import {
  FilterSummary,
  fileFilterKeys,
} from '@/components/files/filter-summary';
const FileSharing = dynamic(() =>
  import('@/components/sharing/file-sharing').then(
    (module) => module.FileSharing,
  ),
);
const FileDetails = dynamic(() =>
  import('@/components/files/details').then((module) => module.FileDetails),
);
const FolderDetails = dynamic(() =>
  import('@/components/folders/details').then((module) => module.FolderDetails),
);
const FolderPicker = dynamic(() =>
  import('@/components/folders/picker').then((module) => module.FolderPicker),
);
import { useUploads } from '@/components/uploads/upload-provider';
import { Overview } from '@/components/analytics/overview';
import { Stats } from '@/components/analytics/stats';
const AnalyticsPanels = dynamic(() =>
  import('@/components/analytics/dashboard').then(
    (module) => module.AnalyticsPanels,
  ),
);
const Settings = dynamic(() =>
  import('@/components/settings').then((module) => module.Settings),
);
const ActivityHistory = dynamic(() =>
  import('@/components/activity').then((module) => module.ActivityHistory),
);
const Shares = dynamic(() =>
  import('@/components/shares').then((module) => module.Shares),
);
type Action = {
  type:
    | 'folder-create'
    | 'collection-create'
    | 'rename'
    | 'move'
    | 'collection'
    | 'trash'
    | 'delete'
    | 'details'
    | 'share'
    | 'revoke-shares'
    | 'sharing-details'
    | 'folder-rename'
    | 'folder-move'
    | 'folder-trash'
    | 'collection-filter'
    | 'folder-filter'
    | 'collection-add'
    | 'folder-details'
    | 'folder-delete'
    | 'empty-trash'
    | 'collection-edit'
    | 'collection-delete';
  file?: VaultFile;
  folder?: VaultFolder;
  collection?: Collection;
  ids?: string[];
};
const titles: Record<string, [string, string]> = {
  '/': [
    'Your space, at a glance',
    'A little more organized. A lot more peace of mind.',
  ],
  '/files': ['My files', 'Files and folders at the root of your vault.'],
  '/recent': [
    'Recent files',
    'Recently opened or uploaded files from every folder.',
  ],
  '/starred': ['Starred', 'Your favorites, always close at hand.'],
  '/documents': [
    'Documents',
    'Your personal library of ideas and information.',
  ],
  '/collections': [
    'Collections',
    'Thoughtful groups. Without duplicate files.',
  ],
  '/trash': ['Trash', 'A second chance for the things you let go.'],
  '/search': [
    'Search your vault',
    'Find files by name or filter by file type.',
  ],
  '/analytics': ['Storage analytics', 'A clear picture of your private space.'],
  '/settings': ['Settings', 'Make this space your own.'],
  '/activity': ['Recent activity', 'Everything that happens in your vault.'],
  '/shared': ['Shared links', 'Your files. Shared on your terms.'],
};
export function Workspace() {
  const {
    authorize,
    requestUnlock,
    prompt: folderPasswordPrompt,
  } = useFolderAuthorization();
  const date = useDateFormatter();
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { pick, add } = useUploads();
  const folderId = pathname.startsWith('/folders/')
    ? pathname.split('/')[2]
    : null;
  const collectionId = pathname.startsWith('/collections/')
    ? pathname.split('/')[2]
    : null;
  const overview = pathname === '/';
  const trash = pathname === '/trash';
  const collectionPage = pathname === '/collections';
  const special = ['/settings', '/shared', '/analytics', '/activity'].includes(
    pathname,
  );
  const [view, setView] = useState('grid');
  const [selected, setSelected] = useState<string[]>([]);
  const [action, setAction] = useState<Action | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuSide, setMenuSide] = useState<'top' | 'bottom'>('bottom');
  function preferMenuSide(trigger: HTMLElement) {
    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const bottom = top + (viewport?.height ?? window.innerHeight);
    setMenuSide(bottom - rect.bottom >= rect.top - top ? 'bottom' : 'top');
  }
  const [drag, setDrag] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [password, setPassword] = useState('');
  const [secureFolder, setSecureFolder] = useState(false);
  const [folderPassword, setFolderPassword] = useState('');
  const [expiry, setExpiry] = useState('');
  const [q, setQ] = useState(params.get('q') ?? '');
  const anchor = useRef<number | null>(null);
  const pendingStars = useRef(new Set<string>());
  useEffect(() => {
    const saved = localStorage.getItem('vault-view');
    if (saved) queueMicrotask(() => setView(saved));
  }, []);
  const queryFromURL = params.get('q') ?? '';
  useEffect(() => {
    queueMicrotask(() => setQ(queryFromURL));
  }, [queryFromURL]);
  useEffect(() => {
    if (overview || special || collectionPage || q === queryFromURL) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q) next.set('q', q);
      else next.delete('q');
      next.delete('page');
      router.replace(pathname + '?' + next.toString());
    }, 350);
    return () => clearTimeout(timer);
  }, [
    q,
    queryFromURL,
    overview,
    special,
    collectionPage,
    pathname,
    params,
    router,
  ]);
  const key = fileQuery(pathname, new URLSearchParams(params.toString()));
  const {
    data,
    isPending,
    error: loadError,
  } = useQuery({
    queryKey: ['files', key],
    queryFn: ({ signal }) =>
      api<FileResponse>(`/api/files?${key}`, undefined, 'GET', signal),
    enabled: !special,
    staleTime: QUERY_STALE_TIME,
    refetchInterval: QUERY_STALE_TIME,
  });
  const hasActiveFilters = fileFilterKeys.some(
    (key) =>
      Boolean(params.get(key)) &&
      !(key === 'type' && params.get(key) === 'all'),
  );
  useEffect(() => {
    queueMicrotask(() => setSelected([]));
    anchor.current = null;
  }, [key]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        document.querySelector('[role="dialog"]') ||
        (event.target instanceof Element &&
          event.target.closest(
            'input,textarea,select,[contenteditable="true"],[role="combobox"],[role="listbox"]',
          ))
      )
        return;
      if (event.key === 'Escape') setSelected([]);
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'a' &&
        !overview &&
        !special &&
        !collectionPage &&
        data?.files.length
      ) {
        event.preventDefault();
        setSelected(data.files.map((file) => file.id));
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [data?.files, overview, special, collectionPage]);
  const title = folderId
    ? (data?.breadcrumbs.at(-1)?.name ?? 'Folder')
    : collectionId
      ? (data?.currentCollection?.name ?? 'Collection')
      : (titles[pathname]?.[0] ?? 'My files');
  const subtitle = folderId
    ? 'A place for everything that belongs together.'
    : collectionId
      ? (data?.currentCollection?.description ?? 'Files, thoughtfully grouped.')
      : titles[pathname]?.[1];
  const showFolders =
    overview || new URLSearchParams(key).get('view') === 'root' || trash;
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    if (key === 'collectionQuery') next.delete('collectionPage');
    router.replace(`${pathname}?${next}`);
    setSelected([]);
  }
  function changeView(next: string) {
    setView(next);
    localStorage.setItem('vault-view', next);
  }
  function openAction(next: Action) {
    setError('');
    setShareUrl('');
    setPassword('');
    setSecureFolder(false);
    setFolderPassword('');
    setExpiry(next.type === 'share' ? defaultShareExpiry() : '');
    setName(
      (next.type === 'rename' && next.file
        ? splitFileName(next.file.displayName).baseName
        : next.file?.displayName) ??
        next.folder?.name ??
        next.collection?.name ??
        '',
    );
    setDescription(
      next.file?.description ??
        next.folder?.description ??
        next.collection?.description ??
        '',
    );
    setDestination(
      next.type === 'collection-filter'
        ? (params.get('collection') ?? '')
        : next.type === 'folder-filter'
          ? (params.get('folder') ?? '')
          : '',
    );
    setAction(next);
  }
  function refreshFileData(
    keys = [
      'files',
      'file-details',
      'analytics',
      'activity',
      'suggestions',
      'shares',
    ],
  ) {
    return Promise.all(
      keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    );
  }
  async function renameFileInline(file: VaultFile, name: string) {
    if (name === file.displayName) return;
    await api('/api/files', { operation: 'rename', id: file.id, name });
    queryClient.setQueriesData<FileResponse>(
      {
        queryKey: ['files'],
        predicate: (query) => query.queryKey[1] !== 'gallery',
      },
      (current) =>
        current
          ? {
              ...current,
              files: current.files.map((item) =>
                item.id === file.id ? { ...item, displayName: name } : item,
              ),
            }
          : current,
    );
    queryClient.setQueryData<{
      file: VaultFile;
      processingError: string | null;
    }>(['file-details', file.id], (current) =>
      current
        ? { ...current, file: { ...current.file, displayName: name } }
        : current,
    );
    void refreshFileData([
      'files',
      'file-details',
      'suggestions',
      'shares',
      'activity',
    ]);
  }
  async function mutate(body: unknown) {
    const result = await authorize<{
      followUp?: { delivered: boolean; message: string };
    }>(() => api('/api/files', body));
    if (result.followUp) {
      setNotice(result.followUp.message);
      window.dispatchEvent(new Event('vault-operations'));
    }
    const starOnly =
      typeof body === 'object' &&
      body !== null &&
      'operation' in body &&
      body.operation === 'bulk' &&
      'action' in body &&
      (body.action === 'star' || body.action === 'unstar');
    void refreshFileData(
      starOnly ? ['files', 'file-details', 'activity'] : undefined,
    );
    setSelected([]);
  }
  async function bulk(action: string, ids = selected) {
    setError('');
    const optimistic = action === 'star' || action === 'unstar';
    if (optimistic && ids.some((id) => pendingStars.current.has(id))) return;
    if (optimistic) for (const id of ids) pendingStars.current.add(id);
    if (optimistic) await queryClient.cancelQueries({ queryKey: ['files'] });
    const previous = optimistic
      ? queryClient.getQueriesData<FileResponse>({
          queryKey: ['files'],
          predicate: (query) => query.queryKey[1] !== 'gallery',
        })
      : [];
    if (optimistic)
      queryClient.setQueriesData<FileResponse>(
        {
          queryKey: ['files'],
          predicate: (query) => query.queryKey[1] !== 'gallery',
        },
        (current) =>
          current
            ? {
                ...current,
                files: current.files.map((file) =>
                  ids.includes(file.id)
                    ? {
                        ...file,
                        starredAt:
                          action === 'star' ? new Date().toISOString() : null,
                      }
                    : file,
                ),
              }
            : current,
      );
    try {
      await mutate({ operation: 'bulk', ids, action });
    } catch (e) {
      for (const [key, value] of previous)
        queryClient.setQueryData<FileResponse>(key, (current) =>
          current
            ? {
                ...current,
                files: current.files.map((file) => {
                  const original = value?.files.find(
                    (item) => item.id === file.id,
                  );
                  return ids.includes(file.id) && original
                    ? { ...file, starredAt: original.starredAt }
                    : file;
                }),
              }
            : current,
        );
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      if (optimistic) for (const id of ids) pendingStars.current.delete(id);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!action) return;
    setBusy(true);
    setError('');
    try {
      if (action.type === 'empty-trash')
        await mutate({ operation: 'empty-trash' });
      if (action.type === 'folder-delete')
        await mutate({ operation: 'folder-delete', id: action.folder?.id });
      if (
        action.type === 'collection-filter' ||
        action.type === 'folder-filter'
      ) {
        filter(
          action.type === 'collection-filter' ? 'collection' : 'folder',
          destination,
        );
        setAction(null);
        return;
      }
      const ids = action.ids ?? (action.file ? [action.file.id] : selected);
      if (action.type === 'folder-create')
        await mutate({
          operation: 'folder-create',
          password: secureFolder ? folderPassword : undefined,
          name,
          parentId: folderId,
          description,
        });
      if (action.type === 'collection-create')
        await mutate({ operation: 'collection-create', name, description });
      if (action.type === 'rename' && action.file) {
        if (!name.trim()) throw new Error('File name cannot be empty.');
        const nameChanged =
          name.trim() !==
          splitFileName(action.file.displayName).baseName.trim();
        const fullName = nameChanged
          ? withFileExtension(action.file.displayName, name)
          : action.file.displayName;
        if (
          fullName !== action.file.displayName ||
          description !== action.file.description
        )
          await mutate({
            operation: 'rename',
            id: action.file.id,
            name: fullName,
            description,
          });
      }
      if (action.type === 'move')
        await mutate({
          operation: 'bulk',
          ids,
          action: 'move',
          folderId: destination || null,
        });
      if (action.type === 'collection')
        await mutate({
          operation: 'collection-membership',
          ids,
          collectionId: destination,
        });
      if (action.type === 'trash' || action.type === 'delete')
        await mutate({ operation: 'bulk', ids, action: action.type });
      if (
        action.type === 'folder-rename' ||
        action.type === 'folder-move' ||
        action.type === 'folder-trash'
      )
        await mutate({
          operation: 'folder-action',
          id: action.folder?.id,
          action: action.type.split('-')[1],
          name: action.type === 'folder-rename' ? name : undefined,
          parentId: destination || null,
        });
      if (action.type === 'collection-edit')
        await mutate({
          operation: 'collection-update',
          id: action.collection?.id,
          name,
          description,
        });
      if (action.type === 'collection-delete')
        await mutate({
          operation: 'collection-delete',
          id: action.collection?.id,
        });
      if (action.type === 'revoke-shares') {
        await api('/api/shares', {
          action: 'revoke-file',
          fileId: action.file?.id,
        });
        void refreshFileData();
        setNotice(
          'Sharing revoked. Existing share links can no longer authorize access.',
        );
      }
      if (action.type === 'share') {
        const result = await api<{ url: string }>('/api/shares', {
          action: 'create',
          fileId: action.file?.id,
          expiresAt: expiry ? new Date(expiry).toISOString() : null,
          password: password || null,
        });
        setShareUrl(result.url);
        void refreshFileData();
        return;
      }
      setAction(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'This action could not be completed.',
      );
    } finally {
      setBusy(false);
    }
  }
  function select(
    file: VaultFile,
    index: number,
    event?: { shiftKey: boolean },
  ) {
    if (event?.shiftKey && anchor.current !== null && data) {
      const range = data.files
        .slice(
          Math.min(anchor.current, index),
          Math.max(anchor.current, index) + 1,
        )
        .map((f) => f.id);
      setSelected((prev) => [...new Set([...prev, ...range])]);
    } else {
      setSelected((prev) =>
        prev.includes(file.id)
          ? prev.filter((id) => id !== file.id)
          : [...prev, file.id],
      );
      anchor.current = index;
    }
  }
  function open(file: VaultFile) {
    if (file.mimeType === 'application/pdf')
      router.push(`/documents/${file.id}`);
    else router.push(`/files/${file.id}`);
  }
  function fileMenu(file: VaultFile) {
    return (
      <Menu.Root>
        <Tooltip label={`Actions for ${file.displayName}`}>
          <Menu.Trigger
            asChild
            onPointerDownCapture={(event) =>
              preferMenuSide(event.currentTarget)
            }
            onKeyDownCapture={(event) => preferMenuSide(event.currentTarget)}
          >
            <button
              className="icon-btn"
              aria-label={`Actions for ${file.displayName}`}
            >
              <MoreHorizontal size={17} />
            </button>
          </Menu.Trigger>
        </Tooltip>
        <Menu.Portal>
          <Menu.Content
            className="menu-content"
            side={menuSide}
            align="end"
            sideOffset={5}
            avoidCollisions
            collisionPadding={12}
            sticky="partial"
          >
            {trash ? (
              <>
                <Menu.Item
                  className="menu-item"
                  disabled={file.processingStatus === 'deleting'}
                  onSelect={() => void bulk('restore', [file.id])}
                >
                  <RotateCcw size={14} />
                  Restore
                </Menu.Item>
                <Menu.Item
                  className="menu-item danger"
                  onSelect={() => openAction({ type: 'delete', file })}
                >
                  <Trash2 size={14} />
                  Delete permanently
                </Menu.Item>
              </>
            ) : (
              <>
                <Menu.Item className="menu-item" onSelect={() => open(file)}>
                  <ArrowUpRight size={14} />
                  Open file
                </Menu.Item>
                <Menu.Item
                  className="menu-item"
                  onSelect={() => openAction({ type: 'rename', file })}
                >
                  <Pencil size={14} />
                  Rename & description
                </Menu.Item>
                <Menu.Item
                  className="menu-item"
                  onSelect={() => openAction({ type: 'move', file })}
                >
                  <FolderInput size={14} />
                  Move to folder
                </Menu.Item>
                <Menu.Item
                  className="menu-item"
                  onSelect={() => openAction({ type: 'collection', file })}
                >
                  <Layers3 size={14} />
                  Add to collection
                </Menu.Item>
                {collectionId && (
                  <Menu.Item
                    className="menu-item"
                    onSelect={() =>
                      void mutate({
                        operation: 'collection-membership',
                        collectionId,
                        ids: [file.id],
                        remove: true,
                      }).catch((e) => setError(e.message))
                    }
                  >
                    <X size={14} />
                    Remove from collection
                  </Menu.Item>
                )}
                <Menu.Item
                  disabled={file.folderProtected}
                  className="menu-item"
                  onSelect={() =>
                    openAction({
                      type: file.activeShareCount ? 'revoke-shares' : 'share',
                      file,
                    })
                  }
                >
                  <Link2 size={14} />
                  {file.folderProtected
                    ? 'Sharing locked by folder'
                    : file.activeShareCount
                      ? 'Revoke link'
                      : 'Share file'}
                </Menu.Item>
                <Menu.Item
                  className="menu-item"
                  onSelect={() => openAction({ type: 'sharing-details', file })}
                >
                  <Info size={14} />
                  Sharing details
                </Menu.Item>
                <Menu.Item asChild className="menu-item">
                  <a href={`/api/files/${file.id}/download`}>
                    <Download size={14} />
                    Download
                  </a>
                </Menu.Item>
                <Menu.Item
                  className="menu-item"
                  onSelect={() => openAction({ type: 'details', file })}
                >
                  <Info size={14} />
                  File details
                </Menu.Item>
                <Menu.Item
                  className="menu-item"
                  onSelect={() => void bulk('reprocess', [file.id])}
                >
                  <RefreshCw size={14} />
                  Reprocess file
                </Menu.Item>
                <Menu.Separator
                  style={{
                    height: 1,
                    background: 'var(--border)',
                    margin: '4px 0',
                  }}
                />
                <Menu.Item
                  className="menu-item danger"
                  onSelect={() => openAction({ type: 'trash', file })}
                >
                  <Trash2 size={14} />
                  Move to trash
                </Menu.Item>
              </>
            )}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    );
  }
  if (data?.lockedFolder)
    return (
      <div className="workspace-page">
        <Link href="/files" className="btn">
          <ChevronLeft size={16} />
          My files
        </Link>
        <FolderUnlock key={data.lockedFolder.id} folder={data.lockedFolder} />
      </div>
    );
  const dialogTitles: Record<Action['type'], string> = {
    'collection-filter': 'Search a collection',
    'folder-filter': 'Search a folder',
    'folder-create': 'Create a folder',
    'collection-create': 'Create a collection',
    rename: 'Edit file',
    move: 'Move files',
    collection: 'Add to collection',
    trash: 'Move to trash?',
    delete: 'Permanently delete?',
    details: 'File details',
    share: 'Share a file',
    'revoke-shares': 'Revoke sharing?',
    'sharing-details': 'Sharing details',
    'folder-rename': 'Rename folder',
    'folder-move': 'Move folder',
    'folder-trash': 'Move folder to trash?',
    'folder-delete': 'Permanently delete folder?',
    'collection-add': 'Add existing files',
    'folder-details': 'Folder details',
    'empty-trash': 'Empty the trash?',
    'collection-edit': 'Edit collection',
    'collection-delete': 'Delete collection?',
  };
  return (
    <div
      className="workspace-page"
      onDragOver={(e) => {
        if (
          Array.from(e.dataTransfer.types).includes('Files') &&
          !special &&
          !collectionId &&
          !collectionPage
        ) {
          e.preventDefault();
          setDrag(true);
        }
      }}
      onDragLeave={(e) => {
        if (
          !e.currentTarget.contains(
            e.relatedTarget instanceof Node ? e.relatedTarget : null,
          )
        )
          setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (!special && !collectionId && !collectionPage)
          add(Array.from(e.dataTransfer.files), folderId);
      }}
    >
      {drag && (
        <div className="workspace-drag-overlay" role="status">
          <div>
            <Upload size={34} />
            <h2>Drop to add to your vault</h2>
            <p>
              {folderId
                ? `Upload into ${data?.breadcrumbs.at(-1)?.name || 'this folder'}`
                : 'Your files, stored privately'}
            </p>
          </div>
        </div>
      )}
      {!overview && (
        <div className="page-heading">
          <div>
            {folderId && (
              <div
                className="muted"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                  marginBottom: 13,
                }}
              >
                <Link href="/files">My files</Link>
                {data?.breadcrumbs.map((c) => (
                  <span
                    key={c.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    <ChevronRight size={12} />
                    <Link href={`/folders/${c.id}`}>{c.name}</Link>
                  </span>
                ))}
              </div>
            )}
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {trash && (
            <button
              className="btn danger"
              disabled={isPending || (!data?.count && !data?.folderCount)}
              onClick={() => openAction({ type: 'empty-trash' })}
            >
              <Trash2 size={15} />
              Empty trash
            </button>
          )}
          {!special && !trash && (
            <div className="page-actions">
              <button
                className="btn"
                onClick={() =>
                  openAction({
                    type: collectionId
                      ? 'collection-add'
                      : collectionPage
                        ? 'collection-create'
                        : 'folder-create',
                  })
                }
              >
                {collectionPage || collectionId ? (
                  <Plus size={16} />
                ) : (
                  <FolderPlus size={16} />
                )}
                <span>
                  {collectionId
                    ? 'Add files'
                    : collectionPage
                      ? 'New collection'
                      : 'New folder'}
                </span>
              </button>
              {collectionId && data?.currentCollection && (
                <button
                  className="btn"
                  onClick={() =>
                    openAction({
                      type: 'collection-edit',
                      collection: data.currentCollection ?? undefined,
                    })
                  }
                >
                  <Pencil size={15} />
                  Edit collection
                </button>
              )}
              {!collectionPage && !collectionId && (
                <button className="btn primary" onClick={() => pick(folderId)}>
                  <Upload size={16} />
                  Upload files
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {pathname === '/activity' ? (
        <ActivityHistory />
      ) : pathname === '/analytics' ? (
        <>
          <Stats />
          <AnalyticsPanels full />
        </>
      ) : pathname === '/settings' ? (
        <Settings />
      ) : pathname === '/shared' ? (
        <Shares />
      ) : (
        <>
          {overview && (
            <>
              <Overview
                onUpload={() => pick(null)}
                onCreateFolder={() => openAction({ type: 'folder-create' })}
              />
              <Stats />
            </>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <Tooltip label="Dismiss notification">
                <button
                  className="icon-btn"
                  aria-label="Dismiss notification"
                  onClick={() => setNotice('')}
                >
                  <X size={14} />
                </button>
              </Tooltip>
            </div>
          )}
          {trash && data?.cleanup?.failed && (
            <div className="notice error" role="alert">
              Storage cleanup failed. Check R2 Object Read &amp; Write
              permissions in your storage configuration, then choose Delete
              permanently again to retry.
            </div>
          )}
          {trash &&
            data?.files.some((file) => file.processingStatus === 'deleting') &&
            data.cleanup?.available && (
              <div className="notice" role="status">
                <RefreshCw size={16} className="vault-spinner" /> Permanent
                deletion is in progress. This view updates automatically.
              </div>
            )}

          {loadError && (
            <div className="notice error" role="alert">
              {loadError.message}
              <button className="btn" onClick={() => void refreshFileData()}>
                Retry
              </button>
            </div>
          )}
          {error && !action && (
            <div className="notice error" role="alert">
              {error}
              <Tooltip label="Dismiss error">
                <button
                  className="icon-btn"
                  onClick={() => setError('')}
                  aria-label="Dismiss error"
                >
                  <X size={14} />
                </button>
              </Tooltip>
            </div>
          )}
          {collectionPage ? (
            <>
              <form
                className="toolbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  filter(
                    'collectionQuery',
                    String(
                      new FormData(e.currentTarget).get('collectionSearch') ??
                        '',
                    ),
                  );
                }}
              >
                <Input
                  name="collectionSearch"
                  aria-label="Find collections"
                  placeholder="Find a collection?"
                  maxLength={200}
                  defaultValue={params.get('collectionQuery') ?? ''}
                />
                <button className="btn">
                  <Search size={14} />
                  Search collections
                </button>
              </form>
              <div className="folder-grid">
                {data?.collections.map((c) => (
                  <div className="card" key={c.id} style={{ padding: 22 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Layers3 size={26} color="#8b5cf6" />
                      <Menu.Root>
                        <Tooltip label={`Actions for ${c.name}`}>
                          <Menu.Trigger
                            asChild
                            onPointerDownCapture={(event) =>
                              preferMenuSide(event.currentTarget)
                            }
                            onKeyDownCapture={(event) =>
                              preferMenuSide(event.currentTarget)
                            }
                          >
                            <button
                              className="icon-btn"
                              aria-label={`Actions for ${c.name}`}
                            >
                              <MoreHorizontal size={17} />
                            </button>
                          </Menu.Trigger>
                        </Tooltip>
                        <Menu.Portal>
                          <Menu.Content
                            className="menu-content"
                            side={menuSide}
                            align="end"
                            sideOffset={5}
                            avoidCollisions
                            collisionPadding={12}
                            sticky="partial"
                          >
                            <Menu.Item
                              className="menu-item"
                              onSelect={() =>
                                openAction({
                                  type: 'collection-edit',
                                  collection: c,
                                })
                              }
                            >
                              Edit collection
                            </Menu.Item>
                            <Menu.Item
                              className="menu-item danger"
                              onSelect={() =>
                                openAction({
                                  type: 'collection-delete',
                                  collection: c,
                                })
                              }
                            >
                              Delete collection
                            </Menu.Item>
                          </Menu.Content>
                        </Menu.Portal>
                      </Menu.Root>
                    </div>
                    <Link href={`/collections/${c.id}`}>
                      <h2 style={{ margin: '18px 0 7px' }}>{c.name}</h2>
                      <p
                        className="muted"
                        style={{
                          fontSize:
                            'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
                        }}
                      >
                        {c.description ||
                          'A collection of things worth keeping.'}
                      </p>
                      <span className="badge">{c.count} files</span>
                    </Link>
                  </div>
                ))}
              </div>
              {data &&
                (data.collectionCount > 100 ||
                  Number(params.get('collectionPage') ?? 1) > 1) && (
                  <div className="pagination">
                    <span>{data.collectionCount} collections</span>
                    <div>
                      <button
                        className="btn"
                        disabled={
                          Number(params.get('collectionPage') ?? 1) <= 1
                        }
                        onClick={() =>
                          filter(
                            'collectionPage',
                            String(
                              Number(params.get('collectionPage') ?? 1) - 1,
                            ),
                          )
                        }
                      >
                        Previous
                      </button>
                      <button
                        className="btn"
                        disabled={
                          Number(params.get('collectionPage') ?? 1) * 100 >=
                          data.collectionCount
                        }
                        onClick={() =>
                          filter(
                            'collectionPage',
                            String(
                              Number(params.get('collectionPage') ?? 1) + 1,
                            ),
                          )
                        }
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              {!isPending && !data?.collections.length && (
                <div className="card empty">
                  <Layers3 size={38} />
                  <h3>A little organization goes a long way</h3>
                  <p>
                    Create collections to bring related files together.
                    <br />
                    Your originals stay exactly where they are.
                  </p>
                  <button
                    className="btn primary"
                    onClick={() => openAction({ type: 'collection-create' })}
                  >
                    <Plus size={15} />
                    Create collection
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {showFolders && (
                <>
                  <div className="section-heading">
                    <h2>{trash ? 'Deleted folders' : 'Folders'}</h2>
                    {overview && (
                      <Link
                        href="/files"
                        className="link"
                        style={{
                          display: 'flex',
                          gap: 5,
                          alignItems: 'center',
                        }}
                      >
                        View all
                        <ChevronRight size={13} />
                      </Link>
                    )}
                  </div>
                  {data?.folders.length ? (
                    <div className="folder-grid">
                      {data.folders.map((f) => (
                        <div className="card folder-card" key={f.id}>
                          <Folder
                            size={30}
                            color="#e5ad43"
                            fill="#fce7b5"
                            strokeWidth={1.5}
                          />
                          <Link
                            href={`/folders/${f.id}`}
                            style={{ minWidth: 0, flex: 1 }}
                          >
                            <div className="file-name">
                              {f.protected && (
                                <LockKeyhole
                                  size={12}
                                  style={{ display: 'inline', marginRight: 5 }}
                                />
                              )}
                              {f.name}
                            </div>
                            <div className="file-subtitle">
                              {trash
                                ? f.purgeRequestedAt
                                  ? 'Permanent cleanup queued'
                                  : date(f.deletedAt)
                                : f.protected
                                  ? f.locked
                                    ? 'Password protected'
                                    : 'Unlocked (30 min session)'
                                  : 'Folder'}
                            </div>
                          </Link>
                          <Menu.Root>
                            <Tooltip label={`Actions for folder ${f.name}`}>
                              <Menu.Trigger
                                asChild
                                onPointerDownCapture={(event) =>
                                  preferMenuSide(event.currentTarget)
                                }
                                onKeyDownCapture={(event) =>
                                  preferMenuSide(event.currentTarget)
                                }
                              >
                                <button
                                  className="icon-btn"
                                  aria-label={`Actions for folder ${f.name}`}
                                >
                                  <MoreHorizontal size={15} />
                                </button>
                              </Menu.Trigger>
                            </Tooltip>
                            <Menu.Portal>
                              <Menu.Content
                                className="menu-content"
                                side={menuSide}
                                align="end"
                                sideOffset={5}
                                avoidCollisions
                                collisionPadding={12}
                                sticky="partial"
                              >
                                {f.protected && (
                                  <Menu.Item
                                    className="menu-item"
                                    onSelect={() => {
                                      if (f.locked) {
                                        void requestUnlock({
                                          id: f.id,
                                          name: f.name,
                                        })
                                          .then((unlocked) => {
                                            if (unlocked)
                                              void queryClient.invalidateQueries(
                                                { queryKey: ['files'] },
                                              );
                                          })
                                          .catch((cause) =>
                                            setError(
                                              cause instanceof Error
                                                ? cause.message
                                                : 'Could not unlock folder.',
                                            ),
                                          );
                                        return;
                                      }
                                      void api(
                                        '/api/folders/' + f.id + '/access',
                                        { action: 'lock' },
                                      )
                                        .then(() => {
                                          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Discard private previews and query caches after locking.
                                          window.location.assign(
                                            '/folders/' + f.id,
                                          );
                                        })
                                        .catch((cause) =>
                                          setError(cause.message),
                                        );
                                    }}
                                  >
                                    <LockKeyhole size={15} />
                                    {f.locked ? 'Unlock folder' : 'Lock folder'}
                                  </Menu.Item>
                                )}
                                {trash ? (
                                  <>
                                    <Menu.Item
                                      className="menu-item"
                                      onSelect={() =>
                                        void mutate({
                                          operation: 'folder-action',
                                          id: f.id,
                                          action: 'restore',
                                        }).catch((e) => setError(e.message))
                                      }
                                    >
                                      Restore folder
                                    </Menu.Item>
                                    <Menu.Item
                                      disabled={Boolean(f.purgeRequestedAt)}
                                      className="menu-item"
                                      onSelect={() =>
                                        openAction({
                                          type: 'folder-rename',
                                          folder: f,
                                        })
                                      }
                                    >
                                      Rename before restoring
                                    </Menu.Item>
                                    <Menu.Item
                                      className="menu-item danger"
                                      onSelect={() =>
                                        openAction({
                                          type: 'folder-delete',
                                          folder: f,
                                        })
                                      }
                                    >
                                      Delete permanently
                                    </Menu.Item>
                                  </>
                                ) : (
                                  <>
                                    <Menu.Item
                                      className="menu-item"
                                      onSelect={() =>
                                        openAction({
                                          type: 'folder-rename',
                                          folder: f,
                                        })
                                      }
                                    >
                                      Rename
                                    </Menu.Item>
                                    <Menu.Item
                                      className="menu-item"
                                      onSelect={() =>
                                        openAction({
                                          type: 'folder-details',
                                          folder: f,
                                        })
                                      }
                                    >
                                      View details
                                    </Menu.Item>
                                    <Menu.Item
                                      className="menu-item"
                                      onSelect={() =>
                                        openAction({
                                          type: 'folder-move',
                                          folder: f,
                                        })
                                      }
                                    >
                                      Move
                                    </Menu.Item>
                                    <Menu.Item
                                      className="menu-item danger"
                                      onSelect={() =>
                                        openAction({
                                          type: 'folder-trash',
                                          folder: f,
                                        })
                                      }
                                    >
                                      Move to trash
                                    </Menu.Item>
                                  </>
                                )}
                              </Menu.Content>
                            </Menu.Portal>
                          </Menu.Root>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="card"
                      style={{
                        padding: '20px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                      }}
                    >
                      <Folder size={28} color="#c5a66a" />
                      <div>
                        <div
                          style={{
                            fontSize:
                              'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
                            fontWeight: 550,
                          }}
                        >
                          {trash
                            ? 'No deleted folders'
                            : 'Room for a little order'}
                        </div>
                        <div
                          className="muted"
                          style={{
                            fontSize:
                              'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                            marginTop: 5,
                          }}
                        >
                          {trash
                            ? 'Deleted folders will appear here.'
                            : 'Create your first folder to give your files a home.'}
                        </div>
                      </div>
                      {!trash && (
                        <Tooltip label="Create your first folder">
                          <button
                            className="icon-btn"
                            style={{ marginLeft: 'auto' }}
                            aria-label="Create your first folder"
                            onClick={() =>
                              openAction({ type: 'folder-create' })
                            }
                          >
                            <Plus size={17} />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  )}
                </>
              )}
              {showFolders && (data?.folderCount ?? 0) > 100 && (
                <div className="pagination">
                  <span>{data?.folderCount} folders</span>
                  <div>
                    <button
                      className="btn"
                      disabled={Number(params.get('folderPage') ?? 1) <= 1}
                      onClick={() =>
                        filter(
                          'folderPage',
                          String(Number(params.get('folderPage') ?? 1) - 1),
                        )
                      }
                    >
                      Previous folders
                    </button>
                    <button
                      className="btn"
                      disabled={
                        Number(params.get('folderPage') ?? 1) * 100 >=
                        (data?.folderCount ?? 0)
                      }
                      onClick={() =>
                        filter(
                          'folderPage',
                          String(Number(params.get('folderPage') ?? 1) + 1),
                        )
                      }
                    >
                      More folders
                    </button>
                  </div>
                </div>
              )}
              <div className="section-heading">
                <h2>
                  {overview
                    ? 'Recent files'
                    : trash
                      ? 'Deleted files'
                      : collectionId
                        ? 'Collection files'
                        : 'Your files'}{' '}
                  {data && (
                    <span
                      className="muted"
                      style={{
                        fontSize:
                          'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                        fontWeight: 400,
                        marginLeft: 5,
                      }}
                    >
                      {data.count} {data.count === 1 ? 'file' : 'files'}
                    </span>
                  )}
                </h2>
                {overview ? (
                  <Link className="link" href="/recent">
                    View all →
                  </Link>
                ) : null}
              </div>
              {!overview && (
                <form
                  className="toolbar file-toolbar"
                  role="search"
                  aria-label="Search workspace files"
                  onSubmit={(event) => {
                    event.preventDefault();
                    filter('q', q);
                  }}
                >
                  <Input
                    className="file-toolbar-search"
                    aria-label="Search files"
                    placeholder="Search by file name or type"
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                  />
                  <FileTypeFilter
                    options={data?.fileTypes ?? []}
                    value={params.getAll('type')}
                    onChange={(types) => {
                      const next = new URLSearchParams(params.toString());
                      next.delete('type');
                      next.delete('page');
                      for (const type of types) next.append('type', type);
                      router.replace(pathname + '?' + next.toString());
                      setSelected([]);
                    }}
                  />
                  <button type="submit" className="btn primary">
                    <Search size={15} />
                    Search
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setQ('');
                      router.replace(pathname);
                      setSelected([]);
                    }}
                  >
                    Clear
                  </button>
                  <div className="file-toolbar-actions">
                    <Select
                      aria-label="Sort files"
                      value={
                        params.get('sort') ??
                        (params.get('q') ? 'relevance' : 'created')
                      }
                      onChange={(e) => filter('sort', e.target.value)}
                      style={{
                        fontSize:
                          'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                        padding: '8px 10px',
                      }}
                    >
                      {params.get('q') && (
                        <option value="relevance">Relevance</option>
                      )}
                      <option value="created">Upload date</option>
                      <option value="name">Name</option>
                      <option value="modified">Modified date</option>
                      <option value="size">File size</option>
                      <option value="type">File type</option>
                    </Select>
                    <div
                      style={{
                        display: 'flex',
                        padding: 3,
                        border: '1px solid var(--border)',
                        borderRadius: 7,
                      }}
                    >
                      <Tooltip label="Grid view">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Grid view"
                          aria-pressed={view === 'grid'}
                          style={{
                            width: 29,
                            height: 27,
                            background:
                              view === 'grid' ? 'var(--soft)' : undefined,
                            color: view === 'grid' ? 'var(--blue)' : undefined,
                          }}
                          onClick={() => changeView('grid')}
                        >
                          <Grid2X2 size={15} />
                        </button>
                      </Tooltip>
                      <Tooltip label="List view">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="List view"
                          aria-pressed={view === 'list'}
                          style={{
                            width: 29,
                            height: 27,
                            background:
                              view === 'list' ? 'var(--soft)' : undefined,
                            color: view === 'list' ? 'var(--blue)' : undefined,
                          }}
                          onClick={() => changeView('list')}
                        >
                          <List size={16} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </form>
              )}
              {!overview && (
                <FilterSummary
                  collectionName={data?.currentCollection?.name}
                  folderName={data?.breadcrumbs.at(-1)?.name}
                />
              )}
              {selected.length > 0 && (
                <div
                  className="card toolbar selection-toolbar"
                  role="region"
                  aria-label="Selected file actions"
                  style={{ padding: '10px 15px', background: 'var(--soft)' }}
                >
                  <strong
                    aria-live="polite"
                    style={{
                      fontSize:
                        'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
                    }}
                  >
                    {selected.length} selected
                  </strong>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {trash ? (
                      <>
                        <button
                          className="btn"
                          onClick={() => void bulk('restore')}
                        >
                          <RotateCcw size={14} />
                          Restore
                        </button>
                        <button
                          className="btn danger"
                          onClick={() =>
                            openAction({ type: 'delete', ids: selected })
                          }
                        >
                          <Trash2 size={14} />
                          Delete forever
                        </button>
                      </>
                    ) : (
                      <>
                        <Tooltip label="Star selected">
                          <button
                            className="icon-btn"
                            aria-label="Star selected"
                            onClick={() => void bulk('star')}
                          >
                            <Star size={16} />
                          </button>
                        </Tooltip>
                        <Tooltip label="Download selected">
                          <button
                            className="icon-btn"
                            aria-label="Download selected"
                            onClick={() => {
                              if (selected.length > 10) {
                                setError(
                                  'Download up to 10 files at a time. Your browser may ask to allow multiple downloads.',
                                );
                                return;
                              }
                              for (const id of selected) {
                                const link = document.createElement('a');
                                link.href = '/api/files/' + id + '/download';
                                link.download = '';
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                              }
                            }}
                          >
                            <Download size={16} />
                          </button>
                        </Tooltip>
                        <Tooltip label="Move selected">
                          <button
                            className="icon-btn"
                            aria-label="Move selected"
                            onClick={() =>
                              openAction({ type: 'move', ids: selected })
                            }
                          >
                            <FolderInput size={17} />
                          </button>
                        </Tooltip>
                        <Tooltip label="Add selected to collection">
                          <button
                            className="icon-btn"
                            aria-label="Add selected to collection"
                            onClick={() =>
                              openAction({ type: 'collection', ids: selected })
                            }
                          >
                            <Layers3 size={16} />
                          </button>
                        </Tooltip>
                        <Tooltip label="Trash selected">
                          <button
                            className="icon-btn danger"
                            aria-label="Trash selected"
                            onClick={() =>
                              openAction({ type: 'trash', ids: selected })
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </Tooltip>
                      </>
                    )}
                    <Tooltip label="Clear selection">
                      <button
                        className="icon-btn"
                        aria-label="Clear selection"
                        onClick={() => setSelected([])}
                      >
                        <X size={16} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              )}
              {!overview && data?.files.length ? (
                <div className="file-selection-row">
                  <label>
                    <Input
                      type="checkbox"
                      checked={data.files.every((file) =>
                        selected.includes(file.id),
                      )}
                      ref={(node) => {
                        if (node)
                          node.indeterminate =
                            selected.length > 0 &&
                            !data.files.every((file) =>
                              selected.includes(file.id),
                            );
                      }}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? data.files.map((file) => file.id)
                            : [],
                        )
                      }
                    />
                    Select this page
                  </label>
                  <span>
                    {(data.page - 1) * data.limit + 1}-
                    {Math.min(data.page * data.limit, data.count)} of{' '}
                    {data.count} files
                  </span>
                  <span className="selection-keyboard-hint">
                    Ctrl/Cmd+A to select | Esc to clear
                  </span>
                </div>
              ) : null}
              {isPending ? (
                <div className="file-grid">
                  {[1, 2, 3, 4].map((n) => (
                    <div className="skeleton" style={{ height: 225 }} key={n} />
                  ))}
                </div>
              ) : data?.files.length ? (
                view === 'grid' ? (
                  <div className="file-grid">
                    {data.files.map((f, i) => (
                      <motion.article
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className={`card file-card ${selected.includes(f.id) ? 'selected' : ''}`}
                        key={f.id}
                      >
                        <Input
                          type="checkbox"
                          className="file-check"
                          aria-label={`Select ${f.displayName}`}
                          checked={selected.includes(f.id)}
                          onChange={(e) =>
                            select(
                              f,
                              i,
                              e.nativeEvent instanceof MouseEvent
                                ? e.nativeEvent
                                : undefined,
                            )
                          }
                        />
                        <Tooltip label={`Open ${f.displayName}`}>
                          <button
                            className="file-preview"
                            style={{ border: 0, width: '100%', padding: 0 }}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey || e.shiftKey)
                                select(f, i, e);
                              else if (!trash) open(f);
                            }}
                            aria-label={`Open ${f.displayName}`}
                          >
                            {!trash &&
                            isGalleryVideo(f.originalFilename, f.mimeType) ? (
                              <VideoThumbnail file={f} />
                            ) : f.hasThumbnail && !trash ? (
                              <img
                                loading="lazy"
                                alt={f.displayName}
                                src={thumbnailUrl(f)}
                              />
                            ) : (
                              <div
                                style={{
                                  color:
                                    f.mimeType === 'application/pdf'
                                      ? '#e38579'
                                      : '#7aa4d5',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: 10,
                                }}
                              >
                                {f.mimeType === 'application/pdf' ? (
                                  <FileText size={49} strokeWidth={1} />
                                ) : f.mimeType.startsWith('image/') ? (
                                  <ImageIcon size={49} strokeWidth={1} />
                                ) : (
                                  <FileText size={49} strokeWidth={1} />
                                )}
                                <span
                                  style={{
                                    fontSize:
                                      'max(9px, calc(11px * var(--vault-font-scale, 1)))',
                                    fontWeight: 700,
                                    letterSpacing: 2,
                                  }}
                                >
                                  {f.mimeType === 'application/pdf'
                                    ? trash && f.processingStatus === 'deleting'
                                      ? 'DELETING'
                                      : 'PDF DOCUMENT'
                                    : f.processingStatus === 'pending'
                                      ? 'PREVIEW PENDING'
                                      : typeLabel(
                                          extensionOf(f.displayName),
                                          f.mimeType,
                                        )}
                                </span>
                              </div>
                            )}
                          </button>
                        </Tooltip>
                        {!trash && (
                          <div className="file-quick-actions">
                            <Tooltip
                              label={f.starredAt ? 'Remove star' : 'Star file'}
                            >
                              <button
                                type="button"
                                className={`icon-btn quick-star ${f.starredAt ? 'is-starred' : ''}`}
                                aria-label={
                                  f.starredAt ? 'Remove star' : 'Star file'
                                }
                                onClick={() =>
                                  void bulk(f.starredAt ? 'unstar' : 'star', [
                                    f.id,
                                  ])
                                }
                              >
                                <Star
                                  size={15}
                                  fill={f.starredAt ? 'currentColor' : 'none'}
                                />
                              </button>
                            </Tooltip>
                            <Tooltip label="File details">
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label="File details"
                                onClick={() =>
                                  openAction({ type: 'details', file: f })
                                }
                              >
                                <Info size={15} />
                              </button>
                            </Tooltip>
                          </div>
                        )}
                        {Boolean(f.activeShareCount) && !trash && (
                          <Tooltip label="Manage shared access">
                            <button
                              type="button"
                              className="file-shared-indicator"
                              aria-label="Manage shared access"
                              onClick={() =>
                                openAction({ type: 'sharing-details', file: f })
                              }
                            >
                              <Link2 size={11} />
                              Shared
                            </button>
                          </Tooltip>
                        )}
                        <div className="file-meta">
                          <div
                            style={{
                              display: 'flex',
                              gap: 7,
                              alignItems: 'center',
                            }}
                          >
                            {f.mimeType === 'application/pdf' ? (
                              <FileText size={14} color="#e38579" />
                            ) : f.mimeType.startsWith('image/') ? (
                              <ImageIcon size={14} color="#7aa4d5" />
                            ) : (
                              <FileText size={14} color="#7aa4d5" />
                            )}
                            <EditableFileName
                              file={f}
                              query={params.get('q') ?? ''}
                              disabled={trash}
                              onRename={renameFileInline}
                            />
                            {f.starredAt && (
                              <Star size={12} color="#eab308" fill="#eab308" />
                            )}
                            {fileMenu(f)}
                          </div>
                          <div className="file-subtitle">
                            {bytes(f.sizeBytes)}
                            <span style={{ margin: '0 6px' }}>·</span>
                            {pathname === '/recent'
                              ? f.lastAccessedAt
                                ? 'Opened '
                                : 'Uploaded '
                              : ''}
                            {date(
                              trash
                                ? f.deletedAt
                                : pathname === '/recent'
                                  ? (f.lastAccessedAt ?? f.createdAt)
                                  : f.createdAt,
                            )}
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                ) : (
                  <div className="card table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th aria-label="Selection" />
                          <th>Name</th>
                          <th>Size</th>
                          <th>{trash ? 'Deleted' : 'Uploaded'}</th>
                          <th>Status</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {data.files.map((f, i) => (
                          <tr key={f.id}>
                            <td>
                              <Input
                                type="checkbox"
                                aria-label={`Select ${f.displayName}`}
                                checked={selected.includes(f.id)}
                                onChange={() => select(f, i)}
                              />
                            </td>
                            <td>
                              <div className="file-list-name">
                                <button
                                  type="button"
                                  className="icon-btn"
                                  disabled={trash}
                                  aria-label={'Open ' + f.displayName}
                                  title="Open file"
                                  onClick={() => open(f)}
                                >
                                  {f.mimeType.startsWith('image/') ? (
                                    <ImageIcon size={21} color="#7aa4d5" />
                                  ) : (
                                    <FileText
                                      size={21}
                                      color={
                                        f.mimeType === 'application/pdf'
                                          ? '#e38579'
                                          : '#7aa4d5'
                                      }
                                    />
                                  )}
                                </button>
                                <EditableFileName
                                  file={f}
                                  query={params.get('q') ?? ''}
                                  disabled={trash}
                                  onRename={renameFileInline}
                                />
                                {f.starredAt && (
                                  <Star
                                    size={11}
                                    fill="#eab308"
                                    color="#eab308"
                                  />
                                )}
                              </div>
                            </td>
                            <td className="muted">{bytes(f.sizeBytes)}</td>
                            <td className="muted">
                              {pathname === '/recent'
                                ? f.lastAccessedAt
                                  ? 'Opened '
                                  : 'Uploaded '
                                : ''}
                              {date(
                                trash
                                  ? f.deletedAt
                                  : pathname === '/recent'
                                    ? (f.lastAccessedAt ?? f.createdAt)
                                    : f.createdAt,
                              )}
                            </td>
                            <td>
                              <span className="badge">
                                {f.processingStatus.replaceAll('_', ' ')}
                              </span>
                            </td>
                            <td>{fileMenu(f)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                !loadError && (
                  <div className="card empty">
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 17,
                        background: 'var(--soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 19px',
                      }}
                    >
                      {trash ? (
                        <Trash2 size={29} />
                      ) : params.get('q') ? (
                        <Search size={29} />
                      ) : (
                        <FilesEmpty />
                      )}
                    </div>
                    <h3>
                      {trash
                        ? 'Nothing in the trash'
                        : hasActiveFilters
                          ? 'No files match your filters'
                          : pathname === '/starred'
                            ? 'Keep your favorites close'
                            : 'Your next favorite thing belongs here'}
                    </h3>
                    <p>
                      {trash
                        ? 'Deleted files will stay here until you restore or permanently delete them.'
                        : hasActiveFilters
                          ? 'Remove a filter above or try a different search.'
                          : pathname === '/starred'
                            ? 'Star a file to find it here whenever you need it.'
                            : 'Upload images and PDFs to start building your private space.'}
                    </p>
                    {!trash && !hasActiveFilters && pathname !== '/starred' && (
                      <button
                        className="btn primary"
                        onClick={() => pick(folderId)}
                      >
                        <Upload size={15} />
                        Upload your first file
                      </button>
                    )}
                  </div>
                )
              )}
              {!overview && data && data.count > data.limit && (
                <div className="pagination">
                  <span>
                    Page {data.page} of {Math.ceil(data.count / data.limit)} ·{' '}
                    {data.count} results
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn"
                      disabled={data.page <= 1}
                      onClick={() => {
                        const next = new URLSearchParams(params.toString());
                        next.set('page', String(data.page - 1));
                        router.push(`${pathname}?${next}`);
                        setSelected([]);
                      }}
                    >
                      <ChevronLeft size={15} />
                      Previous
                    </button>
                    <button
                      className="btn"
                      disabled={data.page * data.limit >= data.count}
                      onClick={() => {
                        const next = new URLSearchParams(params.toString());
                        next.set('page', String(data.page + 1));
                        router.push(`${pathname}?${next}`);
                        setSelected([]);
                      }}
                    >
                      Next
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
              {overview && (
                <div className={`dropzone ${drag ? 'drag' : ''}`}>
                  <span
                    className="stat-icon"
                    style={{
                      width: 43,
                      height: 43,
                      background: 'var(--soft)',
                      color: 'var(--blue)',
                    }}
                  >
                    <Upload size={22} />
                  </span>
                  <div>
                    <strong
                      style={{
                        fontSize:
                          'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
                      }}
                    >
                      A home for everything worth keeping
                    </strong>
                    <div
                      className="muted"
                      style={{
                        fontSize:
                          'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                        marginTop: 5,
                      }}
                    >
                      Drop files here, or{' '}
                      <button
                        style={{
                          background: 'none',
                          border: 0,
                          padding: 0,
                          color: 'var(--blue)',
                          fontSize:
                            'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                        }}
                        onClick={() => pick(folderId)}
                      >
                        browse files
                      </button>{' '}
                      to upload · Any file type
                    </div>
                  </div>
                  <ShieldCheck
                    size={18}
                    color="#94a3b8"
                    style={{ marginLeft: 'auto' }}
                  />
                </div>
              )}
              {overview && <AnalyticsPanels />}
            </>
          )}
        </>
      )}
      <Dialog
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open && !busy) setAction(null);
        }}
        title={action ? dialogTitles[action.type] : ''}
        description={
          action?.type === 'revoke-shares'
            ? 'All links for this file will stop granting access. You can create a new link later.'
            : action?.type === 'delete' ||
                action?.type === 'empty-trash' ||
                action?.type === 'folder-delete'
              ? 'This removes the original, previews, and annotations. This cannot be undone.'
              : action?.type === 'folder-trash'
                ? 'This folder and its active contents will move to trash. You can restore them later.'
                : action?.type === 'collection-delete'
                  ? 'The collection will be removed. Its files remain in your vault.'
                  : action?.type === 'share'
                    ? 'Only this file will be accessible. You can revoke the link at any time.'
                    : action?.type === 'details'
                      ? 'Your original file is stored privately.'
                      : 'Changes are saved to your private vault.'
        }
      >
        {action?.type === 'collection-add' && collectionId ? (
          <CollectionFilePicker
            collectionId={collectionId}
            onDone={() => {
              setAction(null);
              void refreshFileData();
            }}
          />
        ) : action?.type === 'folder-details' && action.folder ? (
          <FolderDetails folder={action.folder} />
        ) : action?.type === 'sharing-details' && action.file ? (
          <FileSharing
            fileId={action.file.id}
            name={action.file.displayName}
            folderProtected={action.file.folderProtected}
          />
        ) : action?.type === 'details' && action.file ? (
          <FileDetails
            key={action.file.id}
            file={action.file}
            onShare={(file) =>
              openAction({
                type: file.activeShareCount ? 'revoke-shares' : 'share',
                file,
              })
            }
          />
        ) : (
          <form onSubmit={save}>
            {action &&
              [
                'folder-create',
                'collection-create',
                'rename',
                'folder-rename',
                'collection-edit',
              ].includes(action.type) && (
                <>
                  <label className="form-field">
                    Name
                    <div
                      className={
                        action.type === 'rename' ? 'file-name-field' : undefined
                      }
                    >
                      <Input
                        placeholder={
                          action?.type.startsWith('folder')
                            ? 'e.g. Personal documents'
                            : action?.type.startsWith('collection')
                              ? 'e.g. Design references'
                              : 'Enter a file name'
                        }
                        autoFocus
                        required
                        maxLength={
                          240 -
                          (action.type === 'rename' && action.file
                            ? splitFileName(action.file.displayName).extension
                                .length
                            : 0)
                        }
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      {action.type === 'rename' &&
                        action.file &&
                        splitFileName(action.file.displayName).extension && (
                          <span
                            className="locked-file-extension"
                            title="File extension cannot be changed"
                          >
                            {splitFileName(action.file.displayName).extension}
                          </span>
                        )}
                    </div>
                  </label>
                  {!action.type.startsWith('folder-rename') && (
                    <label className="form-field">
                      Description
                      <Textarea
                        placeholder="Add a short description (optional)"
                        maxLength={2000}
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </label>
                  )}
                </>
              )}
            {action?.type === 'folder-create' && (
              <div className="folder-password-options">
                <label className="form-field">
                  <span>
                    <input
                      type="checkbox"
                      checked={secureFolder}
                      onChange={(event) =>
                        setSecureFolder(event.target.checked)
                      }
                    />{' '}
                    Protect with a password
                  </span>
                </label>
                {secureFolder && (
                  <label className="form-field">
                    Folder password
                    <PasswordInput
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      placeholder="Choose a folder password (8+ characters)"
                      value={folderPassword}
                      onChange={(event) =>
                        setFolderPassword(event.target.value)
                      }
                    />
                    <span className="muted">
                      Required to open this folder and its contents. Keep this
                      password safe.
                    </span>
                  </label>
                )}
              </div>
            )}
            {action &&
              ['move', 'folder-move', 'collection'].includes(action.type) &&
              (action.type === 'collection' ? (
                <CollectionPicker
                  value={destination}
                  onChange={setDestination}
                />
              ) : (
                <FolderPicker
                  exclude={action.folder?.id}
                  onChange={setDestination}
                />
              ))}
            {action?.type === 'collection-filter' && (
              <CollectionPicker
                value={destination}
                onChange={setDestination}
                allowNone
              />
            )}
            {action?.type === 'folder-filter' && (
              <FolderPicker
                value={destination}
                label="Search folder"
                onChange={setDestination}
              />
            )}
            {action?.type === 'share' && (
              <>
                {shareUrl ? (
                  <div className="notice" style={{ marginTop: 18 }}>
                    <Check size={17} style={{ display: 'inline' }} /> Link
                    created. Copy it now; raw tokens are never stored.
                    <Input
                      placeholder="Your new share link"
                      readOnly
                      aria-label="Created share URL"
                      value={shareUrl}
                      style={{ width: '100%', marginTop: 10 }}
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      className="btn"
                      style={{ marginTop: 10 }}
                      onClick={() =>
                        navigator.clipboard
                          .writeText(shareUrl)
                          .catch(() =>
                            setError(
                              'Copy failed. Select and copy the link manually.',
                            ),
                          )
                      }
                    >
                      Copy link
                    </button>
                  </div>
                ) : (
                  <>
                    <label className="form-field">
                      Expiration (optional)
                      <DateTimePicker
                        aria-label="Share link expiration"
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      Password (optional, at least 8 characters)
                      <PasswordInput
                        placeholder="Set a password (optional, 8+ characters)"
                        autoComplete="new-password"
                        minLength={password ? 8 : undefined}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                  </>
                )}
              </>
            )}
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                {shareUrl ? 'Done' : 'Cancel'}
              </button>
              {!shareUrl && (
                <button
                  className={`btn ${action && ['delete', 'empty-trash', 'folder-delete', 'folder-trash', 'trash', 'collection-delete', 'revoke-shares'].includes(action.type) ? 'danger' : 'primary'}`}
                  disabled={
                    busy || (action?.type === 'collection' && !destination)
                  }
                >
                  {busy
                    ? 'Saving…'
                    : action?.type === 'share'
                      ? 'Create secure link'
                      : action &&
                          ['trash', 'folder-trash'].includes(action.type)
                        ? 'Move to trash'
                        : action?.type === 'revoke-shares'
                          ? 'Revoke sharing'
                          : action?.type === 'delete'
                            ? 'Delete permanently'
                            : action?.type === 'empty-trash'
                              ? 'Empty trash'
                              : action?.type === 'folder-delete'
                                ? 'Delete permanently'
                                : action?.type === 'collection-delete'
                                  ? 'Delete collection'
                                  : 'Save changes'}
                </button>
              )}
            </div>
          </form>
        )}
      </Dialog>
      {folderPasswordPrompt}
    </div>
  );
}
function FilesEmpty() {
  return <Folder size={29} color="#6c96d7" />;
}
