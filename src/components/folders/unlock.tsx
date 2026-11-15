'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { LockKeyhole, LoaderCircle } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';
import { api } from '@/lib/client';
export function FolderUnlock({
  folder,
}: {
  folder: { id: string; name: string };
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const router = useRouter();
  async function unlock() {
    if (busy || !password) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/folders/' + folder.id + '/access', {
        action: 'unlock',
        password,
      });
      setPassword('');
      await client.invalidateQueries();
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not unlock folder.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="folder-unlock card">
      <div className="folder-lock-symbol">
        <LockKeyhole size={28} />
      </div>
      <h2>{folder.name}</h2>
      <p className="muted">
        Enter the folder password to access its contents.
      </p>
      <label className="form-field">
        Folder password
        <PasswordInput
          autoComplete="off"
          placeholder="Enter folder password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void unlock();
            }
          }}
        />
      </label>
      {error && (
        <p className="danger" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn primary"
        disabled={busy || !password}
        onClick={() => void unlock()}
      >
        {busy && <LoaderCircle size={16} className="vault-spinner" />}
        {busy ? 'Unlocking...' : 'Unlock folder'}
      </button>
      <p className="muted">
        Unlocked for 30 minutes in this session. Folder passwords do not encrypt
        stored files.
      </p>
    </div>
  );
}
