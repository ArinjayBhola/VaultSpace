'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LockKeyhole, LoaderCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { PasswordInput } from '@/components/ui/password-input';
import { api, ApiClientError } from '@/lib/client';

type Folder = { id: string; name: string };

function FolderPasswordPrompt({
  folder,
  onUnlocked,
  onCancel,
  onRequired,
}: {
  folder: Folder;
  onUnlocked: () => void;
  onCancel: () => void;
  onRequired: (folder: Folder) => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !password) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await api('/api/folders/' + folder.id + '/access', {
        action: 'unlock',
        password,
      });
      setPassword('');
      onUnlocked();
    } catch (cause) {
      if (
        cause instanceof ApiClientError &&
        cause.code === 'FOLDER_LOCKED' &&
        cause.folder &&
        cause.folder.id !== folder.id
      ) {
        onRequired(cause.folder);
        return;
      }
      setError(
        cause instanceof Error ? cause.message : 'Could not unlock folder.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
      title={'Unlock ' + folder.name}
      description="Enter this folder's password to continue the requested action. You can unlock it here without restoring or moving it."
    >
      <form onSubmit={unlock}>
        <p className="folder-unlock-target">
          <LockKeyhole size={18} />
          <strong>{folder.name}</strong>
        </p>
        <label className="form-field">
          Folder password
          <PasswordInput
            required
            autoFocus
            disabled={busy}
            maxLength={128}
            autoComplete="off"
            placeholder={'Password for ' + folder.name}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <p className="muted">
          If another folder needs a password, it will be requested next.
        </p>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel action
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={busy || !password}
          >
            {busy && <LoaderCircle size={16} className="vault-spinner" />}
            {busy ? 'Unlocking...' : 'Unlock and continue'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function useFolderAuthorization() {
  const [folder, setFolder] = useState<Folder | null>(null);
  const resolve = useRef<((unlocked: boolean) => void) | null>(null);
  useEffect(
    () => () => {
      resolve.current?.(false);
      resolve.current = null;
    },
    [],
  );
  function finish(unlocked: boolean) {
    const complete = resolve.current;
    resolve.current = null;
    setFolder(null);
    complete?.(unlocked);
  }
  function requestUnlock(target: Folder) {
    if (resolve.current)
      throw new Error(
        'Finish the current folder unlock before starting another action.',
      );
    return new Promise<boolean>((complete) => {
      resolve.current = complete;
      setFolder(target);
    });
  }
  async function authorize<T>(operation: () => Promise<T>): Promise<T> {
    for (;;) {
      try {
        return await operation();
      } catch (cause) {
        if (
          !(cause instanceof ApiClientError) ||
          cause.status !== 423 ||
          cause.code !== 'FOLDER_LOCKED' ||
          !cause.folder
        )
          throw cause;
        if (!(await requestUnlock(cause.folder)))
          throw new Error('Action cancelled.');
      }
    }
  }
  return {
    authorize,
    requestUnlock,
    prompt: folder ? (
      <FolderPasswordPrompt
        key={folder.id}
        folder={folder}
        onUnlocked={() => finish(true)}
        onCancel={() => finish(false)}
        onRequired={setFolder}
      />
    ) : null,
  };
}
