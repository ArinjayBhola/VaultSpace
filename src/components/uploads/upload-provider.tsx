'use client';

import { Tooltip } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  RotateCcw,
  LoaderCircle,
} from 'lucide-react';
import { api, bytes } from '@/lib/client';
import { Dialog } from '@/components/ui/dialog';
import { uploadMime } from '@/lib/file-types';
import { validFile } from '@/lib/validation';
type State =
  | 'Queued'
  | 'Preparing'
  | 'Uploading'
  | 'Verifying'
  | 'Processing'
  | 'Ready'
  | 'Failed'
  | 'Cancelled';
type Item = {
  key: string;
  file: File;
  folderId: string | null;
  state: State;
  progress: number;
  speed: number;
  error?: string;
  sessionId?: string;
  fileId?: string;
  uploaded?: boolean;
  processing?: string;
};
type UploadSession = {
  id: string;
  fileId: string;
  multipart: boolean;
  partSize: number;
  url: string | null;
  duplicate?: { id: string; name: string };
};
const Context = createContext<{
  pick: (folder?: string | null) => void;
  add: (files: File[], folder?: string | null) => void;
}>({ pick: () => {}, add: () => {} });
export const useUploads = () => useContext(Context);
export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [pollError, setPollError] = useState('');
  const serialQueue = useRef(Promise.resolve());
  const cancelledQueue = useRef(new Set<string>());
  const [duplicate, setDuplicate] = useState<{
    name: string;
    resolve: (value: 'keep' | 'cancel' | 'rename') => void;
  } | null>(null);
  const [rename, setRename] = useState('');
  const renameValue = useRef('');
  const input = useRef<HTMLInputElement>(null);
  const folder = useRef<string | null>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const queryClient = useQueryClient();
  const pendingProcessing = items
    .filter((item) => item.uploaded && item.state === 'Processing')
    .slice(0, 100)
    .map((item) => item.fileId)
    .filter((value): value is string => Boolean(value))
    .join(',');
  useEffect(() => {
    if (!pendingProcessing) return;
    const poll = async () => {
      try {
        const rows = await api<
          { id: string; status: string; deleted: string | null }[]
        >(`/api/uploads?ids=${pendingProcessing}`);
        setPollError('');
        setItems((previous) =>
          previous.map((item) => {
            const row = rows.find((r) => r.id === item.fileId);
            if (!row) return item;
            if (row.deleted)
              return {
                ...item,
                state: 'Cancelled',
                error: 'Uploaded file was moved to trash.',
              };
            if (['pending', 'processing'].includes(row.status)) return item;
            if (row.status === 'failed')
              return {
                ...item,
                state: 'Failed',
                error:
                  'Upload succeeded. Thumbnail generation failed; retry processing or open file details.',
                processing: row.status,
              };
            return { ...item, state: 'Ready', processing: row.status };
          }),
        );
        await queryClient.invalidateQueries({ queryKey: ['files'] });
      } catch (e) {
        setPollError(
          e instanceof Error
            ? e.message
            : 'Processing status is temporarily unavailable.',
        );
      }
    };
    const timer = setInterval(() => void poll(), 3000);
    return () => clearInterval(timer);
  }, [pendingProcessing, queryClient]);
  const update = useCallback(
    (key: string, patch: Partial<Item>) =>
      setItems((prev) =>
        prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
      ),
    [],
  );
  const active = items.some((item) =>
    ['Preparing', 'Uploading', 'Verifying'].includes(item.state),
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    if (active) window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
  async function transfer(
    url: string,
    body: Blob,
    signal: AbortSignal,
    onProgress: (bytes: number) => void,
  ) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      signal.addEventListener('abort', abort, { once: true });
      xhr.open('PUT', url);
      if (body.type) xhr.setRequestHeader('Content-Type', body.type);
      xhr.upload.onprogress = (e) => onProgress(e.loaded);
      const done = () => signal.removeEventListener('abort', abort);
      xhr.onload = () => {
        done();
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else
          reject(
            new Error(
              `Transfer failed (${xhr.status}). Check R2 CORS or retry.`,
            ),
          );
      };
      xhr.onerror = () => {
        done();
        reject(
          new Error(
            'Network transfer failed. Check your connection and R2 CORS.',
          ),
        );
      };
      xhr.onabort = () => {
        done();
        reject(new DOMException('Upload cancelled', 'AbortError'));
      };
      if (signal.aborted) {
        done();
        reject(new DOMException('Upload cancelled', 'AbortError'));
      } else xhr.send(body);
    });
  }
  async function run(item: Item) {
    if (cancelledQueue.current.has(item.key)) return;
    const controller = new AbortController();
    controllers.current.set(item.key, controller);
    let sessionId: string | undefined;
    let serverFileId: string | undefined;
    let verifying = false;
    try {
      update(item.key, { state: 'Preparing', progress: 0, error: undefined });
      const policy = await queryClient.fetchQuery({
        queryKey: ['upload-policy'],
        queryFn: () => api<{ maxBytes: number }>('/api/uploads'),
        staleTime: 30000,
      });
      if (
        !validFile(
          item.file.name,
          uploadMime(item.file.name, item.file.type),
          item.file.size,
          policy.maxBytes,
        )
      )
        throw new Error(`Choose a file up to ${bytes(policy.maxBytes)}.`);
      const digest =
        item.file.size <= 50 * 1024 * 1024
          ? Array.from(
              new Uint8Array(
                await crypto.subtle.digest(
                  'SHA-256',
                  await item.file.arrayBuffer(),
                ),
              ),
            )
              .map((v) => v.toString(16).padStart(2, '0'))
              .join('')
          : null;
      let filename = item.file.name;
      let session = await api<UploadSession>('/api/uploads', {
        action: 'create',
        name: filename,
        mime: uploadMime(item.file.name, item.file.type),
        size: item.file.size,
        folderId: item.folderId,
        checksum: digest,
      });
      if (session.duplicate) {
        setRename(filename);
        renameValue.current = filename;
        const choice = await new Promise<'keep' | 'cancel' | 'rename'>(
          (resolve) => setDuplicate({ name: session.duplicate!.name, resolve }),
        );
        setDuplicate(null);
        if (choice === 'cancel')
          throw new DOMException('Upload cancelled', 'AbortError');
        if (choice === 'rename') {
          filename = renameValue.current.trim() || filename;
        }
        session = await api<UploadSession>('/api/uploads', {
          action: 'create',
          name: filename,
          mime: uploadMime(item.file.name, item.file.type),
          size: item.file.size,
          folderId: item.folderId,
          checksum: digest,
          duplicatePolicy: 'keep',
        });
      }
      sessionId = session.id;
      serverFileId = session.fileId;
      update(item.key, { sessionId, fileId: session.fileId });
      if (controller.signal.aborted)
        throw new DOMException('Upload cancelled', 'AbortError');
      update(item.key, { state: 'Uploading' });
      const start = performance.now();
      let completed = 0;
      const loaded = new Map<number, number>();
      const progress = () => {
        const total =
          completed + [...loaded.values()].reduce((a, b) => a + b, 0);
        update(item.key, {
          progress: Math.min(100, (total / item.file.size) * 100),
          speed: total / Math.max(0.1, (performance.now() - start) / 1000),
        });
      };
      if (session.multipart) {
        const parts = Math.ceil(item.file.size / session.partSize);
        let next = 1;
        const worker = async () => {
          while (next <= parts) {
            const part = next++;
            const body = item.file.slice(
              (part - 1) * session.partSize,
              Math.min(part * session.partSize, item.file.size),
            );
            for (let attempt = 0; ; attempt++) {
              try {
                if (controller.signal.aborted)
                  throw new DOMException('Upload cancelled', 'AbortError');
                const signed = await api<{ url: string }>('/api/uploads', {
                  action: 'part',
                  id: session.id,
                  part,
                });
                await transfer(signed.url, body, controller.signal, (n) => {
                  loaded.set(part, n);
                  progress();
                });
                loaded.delete(part);
                completed += body.size;
                progress();
                break;
              } catch (e) {
                if (controller.signal.aborted || attempt >= 2) throw e;
                loaded.delete(part);
                await new Promise((resolve) =>
                  setTimeout(resolve, 500 * 2 ** attempt),
                );
              }
            }
          }
        };
        await Promise.all(
          Array.from(
            {
              length: Math.max(
                1,
                Math.min(
                  6,
                  Number(localStorage.getItem('vault-upload-concurrency')) || 3,
                ),
              ),
            },
            worker,
          ),
        );
      } else {
        if (!session.url) throw new Error('Upload authorization missing.');
        await transfer(session.url, item.file, controller.signal, (n) => {
          loaded.set(0, n);
          progress();
        });
      }
      update(item.key, { state: 'Verifying', progress: 100 });
      verifying = true;
      await api('/api/uploads', { action: 'complete', id: session.id });
      update(item.key, { state: 'Processing', speed: 0, uploaded: true });
      window.dispatchEvent(new Event('vault-operations'));
      void Promise.all(
        ['files', 'analytics', 'activity', 'suggestions'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
    } catch (e) {
      const cancelled =
        controller.signal.aborted ||
        (e instanceof DOMException && e.name === 'AbortError');
      controller.abort();
      if (verifying && !cancelled && sessionId) {
        try {
          await api('/api/uploads', { action: 'complete', id: sessionId });
          update(item.key, {
            state: 'Processing',
            uploaded: true,
            fileId: serverFileId,
            error: undefined,
            speed: 0,
          });
          void Promise.all(
            ['files', 'analytics', 'activity', 'suggestions'].map((key) =>
              queryClient.invalidateQueries({ queryKey: [key] }),
            ),
          );
          return;
        } catch {
          /* The original failure remains visible; cancellation below releases a pending session when possible. */
        }
      }
      update(item.key, {
        state: cancelled ? 'Cancelled' : 'Failed',
        error: cancelled
          ? undefined
          : e instanceof Error
            ? e.message
            : 'Upload failed.',
        speed: 0,
      });
      if (sessionId) {
        try {
          await api('/api/uploads', { action: 'cancel', id: sessionId });
        } catch (error) {
          update(item.key, {
            error:
              (e instanceof Error ? e.message : 'Upload failed.') +
              ' Cleanup pending: ' +
              (error instanceof Error
                ? error.message
                : 'Server cancellation failed. Cleanup will retry.'),
          });
        }
      }
    } finally {
      controllers.current.delete(item.key);
    }
  }
  function add(files: File[], folderId: string | null = null) {
    setMinimized(false);
    const queue = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      folderId,
      state: 'Queued' as const,
      progress: 0,
      speed: 0,
    }));
    setItems((prev) => [...prev, ...queue]);
    serialQueue.current = serialQueue.current.then(async () => {
      for (const item of queue) await run(item);
    });
  }
  function pick(folderId: string | null = null) {
    folder.current = folderId;
    input.current?.click();
  }
  return (
    <Context.Provider value={{ pick, add }}>
      {children}
      <Input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          add(Array.from(e.target.files ?? []), folder.current);
          e.target.value = '';
        }}
      />
      {items.length > 0 && (
        <aside
          className="upload-panel card"
          aria-label="Upload manager"
          aria-live="polite"
        >
          <div className="upload-header">
            <strong
              style={{
                fontSize: 'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
              }}
            >
              Uploads · {items.filter((i) => i.uploaded).length} transferred
              {items.some((i) => i.state === 'Failed')
                ? ` · ${items.filter((i) => i.state === 'Failed').length} failed`
                : ''}
            </strong>
            <div>
              <Tooltip
                label={minimized ? 'Expand uploads' : 'Minimize uploads'}
              >
                <button
                  className="icon-btn"
                  aria-label={minimized ? 'Expand uploads' : 'Minimize uploads'}
                  onClick={() => setMinimized(!minimized)}
                >
                  {minimized ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>
              </Tooltip>
              {!active && (
                <Tooltip label="Dismiss upload manager">
                  <button
                    className="icon-btn"
                    aria-label="Dismiss upload manager"
                    onClick={() => setItems([])}
                  >
                    <X size={16} />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
          {pollError && (
            <p role="alert" className="notice error" style={{ margin: 8 }}>
              {pollError}
            </p>
          )}
          {!minimized && (
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {items.map((item) => (
                <div className="upload-item" key={item.key}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    {item.state === 'Ready' ? (
                      <Check size={16} color="#16a34a" />
                    ) : ['Failed', 'Cancelled'].includes(item.state) ? (
                      <X size={16} color="#dc2626" />
                    ) : item.state === 'Uploading' ? (
                      <Upload size={16} color="#2563eb" />
                    ) : (
                      <LoaderCircle
                        size={16}
                        className="vault-spinner"
                        aria-label={item.state}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="file-name">{item.file.name}</div>
                      <div className="file-subtitle">
                        {item.state === 'Processing'
                          ? item.file.type === 'application/pdf'
                            ? 'Uploaded ? generating thumbnail'
                            : 'Uploaded - preparing image preview'
                          : item.state === 'Ready'
                            ? `Ready ? ${item.processing?.replaceAll('_', ' ') ?? 'original available'}`
                            : item.state}
                        {item.state === 'Uploading' && item.speed > 0
                          ? ` · ${bytes(item.speed)}/s`
                          : ''}
                      </div>
                    </div>
                    {item.state === 'Failed' && (
                      <Tooltip label={`Retry ${item.file.name}`}>
                        <button
                          className="icon-btn"
                          aria-label={`Retry ${item.file.name}`}
                          onClick={() => {
                            if (item.uploaded && item.fileId) {
                              void api('/api/files', {
                                operation: 'bulk',
                                ids: [item.fileId],
                                action: 'reprocess',
                              })
                                .then(() => {
                                  window.dispatchEvent(
                                    new Event('vault-operations'),
                                  );
                                  return update(item.key, {
                                    state: 'Processing',
                                    error: undefined,
                                  });
                                })
                                .catch((e) =>
                                  update(item.key, {
                                    error:
                                      e instanceof Error
                                        ? e.message
                                        : 'Processing retry failed.',
                                  }),
                                );
                            } else void run(item);
                          }}
                        >
                          <RotateCcw size={15} />
                        </button>
                      </Tooltip>
                    )}
                    {['Queued', 'Preparing', 'Uploading'].includes(
                      item.state,
                    ) && (
                      <Tooltip label={`Cancel ${item.file.name}`}>
                        <button
                          className="icon-btn"
                          aria-label={`Cancel ${item.file.name}`}
                          onClick={() => {
                            cancelledQueue.current.add(item.key);
                            controllers.current.get(item.key)?.abort();
                            if (item.state === 'Queued')
                              update(item.key, { state: 'Cancelled' });
                          }}
                        >
                          <X size={15} />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                  {['Uploading', 'Verifying'].includes(item.state) && (
                    <progress
                      max={100}
                      value={
                        item.state === 'Verifying' ? undefined : item.progress
                      }
                      className="upload-progress"
                      aria-label={`${item.file.name} ${item.state === 'Verifying' ? 'verification in progress' : 'upload progress'}`}
                    />
                  )}{' '}
                  {item.error && (
                    <p
                      className="danger"
                      style={{
                        fontSize:
                          'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                        margin: '8px 0 0',
                      }}
                    >
                      {item.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      )}
      <Dialog
        open={Boolean(duplicate)}
        onOpenChange={(open) => {
          if (!open) duplicate?.resolve('cancel');
        }}
        title="This file is already in your vault"
        description={`A matching checksum was found for “${duplicate?.name ?? ''}”. Choose how to continue.`}
      >
        <label className="form-field">
          Name for the new file
          <Input
            placeholder="Enter a name for this copy"
            id="duplicate-name"
            value={rename}
            onChange={(e) => {
              setRename(e.target.value);
              renameValue.current = e.target.value;
            }}
          />
        </label>
        <div className="dialog-actions">
          <button className="btn" onClick={() => duplicate?.resolve('cancel')}>
            Cancel
          </button>
          <button className="btn" onClick={() => duplicate?.resolve('rename')}>
            Use new name
          </button>
          <button
            className="btn primary"
            onClick={() => duplicate?.resolve('keep')}
          >
            Keep both
          </button>
        </div>
      </Dialog>
    </Context.Provider>
  );
}
