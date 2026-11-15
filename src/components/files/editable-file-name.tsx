'use client';
import { useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { HighlightText } from '@/components/search/highlight';
import { splitFileName, withFileExtension } from '@/lib/file-name';
import { name as fileNameSchema } from '@/lib/validation';
import type { VaultFile } from '@/types';
export function EditableFileName({
  file,
  query = '',
  disabled = false,
  onRename,
}: {
  file: VaultFile;
  query?: string;
  disabled?: boolean;
  onRename: (file: VaultFile, name: string) => Promise<void>;
}) {
  const parts = splitFileName(file.displayName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(parts.baseName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cancelled = useRef(false);
  const submitting = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function begin() {
    if (disabled || saving) return;
    cancelled.current = false;
    setDraft(parts.baseName);
    setError('');
    setEditing(true);
  }
  async function commit() {
    if (cancelled.current || submitting.current) return;
    setEditing(false);
    if (draft.trim() === parts.baseName.trim()) {
      setError('');
      return;
    }
    if (!draft.trim()) {
      setError('File name cannot be empty. The original name was kept.');
      return;
    }
    const parsed = fileNameSchema.safeParse(
      withFileExtension(file.displayName, draft),
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid file name.');
      return;
    }
    if (parsed.data === file.displayName) {
      setError('');
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      await onRename(file, parsed.data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The file could not be renamed. Try again.',
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return (
    <div
      className="inline-file-name"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {editing ? (
        <div className="file-name-field inline-file-name-field">
          <Input
            autoFocus
            className="inline-file-name-input"
            aria-label="File name"
            placeholder="Enter file name"
            value={draft}
            maxLength={240 - parts.extension.length}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.blur();
                requestAnimationFrame(() => trigger.current?.focus());
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelled.current = true;
                setEditing(false);
                setError('');
                requestAnimationFrame(() => trigger.current?.focus());
              }
            }}
          />
        </div>
      ) : (
        <button
          ref={trigger}
          type="button"
          className="file-name inline-file-name-trigger"
          disabled={disabled}
          aria-disabled={disabled || saving}
          aria-label={'Rename ' + file.displayName}
          aria-busy={saving}
          title={
            disabled
              ? file.displayName
              : 'Double-click to rename. Press F2 or Enter when focused.'
          }
          onDoubleClick={begin}
          onClick={(event) => {
            if (event.detail === 0) begin();
          }}
          onKeyDown={(event) => {
            if (event.key === 'F2') {
              event.preventDefault();
              event.stopPropagation();
              begin();
            }
          }}
        >
          {saving ? (
            <span className="inline-file-name-saving">
              <LoaderCircle
                size={13}
                className="vault-spinner"
                aria-hidden="true"
              />
              {withFileExtension(file.displayName, draft)}
            </span>
          ) : (
            <HighlightText text={file.displayName} query={query} />
          )}
        </button>
      )}
      {error && (
        <span className="inline-file-name-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
