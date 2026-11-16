'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Pencil } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { api } from '@/lib/client';
import { splitFileName, withFileExtension } from '@/lib/file-name';
import { name as fileNameSchema } from '@/lib/validation';
import type { FileResponse, VaultFile } from '@/types';

export function FileMetadataEditor({ file }: { file: VaultFile }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const submitting = useRef(false);
  const parts = splitFileName(file.displayName);
  const changed =
    name.trim() !== parts.baseName.trim() || description !== file.description;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!changed) {
      setOpen(false);
      return;
    }
    if (!name.trim()) {
      setError('Enter a file name.');
      return;
    }
    const fullName =
      name.trim() === parts.baseName.trim()
        ? file.displayName
        : withFileExtension(file.displayName, name);
    const parsed = fileNameSchema.safeParse(fullName);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid file name.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await api('/api/files', {
        operation: 'rename',
        id: file.id,
        name: parsed.data,
        description,
      });
      client.setQueryData<{ file: VaultFile; processingError?: string | null }>(
        ['file-details', file.id],
        (current) =>
          current
            ? {
                ...current,
                file: {
                  ...current.file,
                  displayName: parsed.data,
                  description,
                },
              }
            : current,
      );
      client.setQueriesData<FileResponse>(
        {
          queryKey: ['files'],
          predicate: (query) => query.queryKey[1] !== 'gallery',
        },
        (current) =>
          current
            ? {
                ...current,
                files: current.files.map((item) =>
                  item.id === file.id
                    ? { ...item, displayName: parsed.data, description }
                    : item,
                ),
              }
            : current,
      );
      setOpen(false);
      setNotice('Changes saved.');
      void Promise.all(
        [
          'file-details',
          'files',
          'suggestions',
          'shares',
          'activity',
          'pdf',
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not save changes. Try again.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <div className="file-edit-control">
        {notice && (
          <span role="status" className="muted">
            {notice}
          </span>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => {
            setName(parts.baseName);
            setDescription(file.description);
            setError('');
            setNotice('');
            setOpen(true);
          }}
        >
          <Pencil size={16} />
          Edit file
        </button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title="Edit file"
        description="Update the name and description. The file extension stays unchanged."
      >
        <form onSubmit={save}>
          <label className="form-field">
            Name
            <div className="file-name-field">
              <Input
                required
                autoFocus
                disabled={busy}
                placeholder="Enter file name"
                maxLength={240 - parts.extension.length}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              {parts.extension && (
                <span
                  className="locked-file-extension"
                  title="File extension cannot be changed"
                >
                  {parts.extension}
                </span>
              )}
            </div>
          </label>
          <label className="form-field">
            Description
            <Textarea
              disabled={busy}
              placeholder="Add a description (optional)"
              rows={4}
              maxLength={10000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
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
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={busy || !changed}
            >
              {busy && <LoaderCircle size={16} className="vault-spinner" />}
              {busy ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
