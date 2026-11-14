'use client';

import { PasswordInput } from '@/components/ui/password-input';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link2,
  Users,
  Eye,
  Plus,
  Copy,
  Clock3,
  ShieldCheck,
  LoaderCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, date } from '@/lib/client';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DateTimePicker } from '@/components/ui/date-picker';
type Share = {
  id: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  protected: boolean;
  active: boolean;
  activeViewers: number;
};
type Response = {
  items: Share[];
  totals: { views: number; activeLinks: number; activeViewers: number };
  count: number;
  page: number;
  limit: number;
};
export function FileSharing({
  fileId,
  name,
}: {
  fileId: string;
  name: string;
}) {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revoke, setRevoke] = useState<Share | null>(null);
  const [copied, setCopied] = useState(false);
  const {
    data,
    error: loadError,
    refetch,
    isPending,
  } = useQuery({
    queryKey: ['shares', fileId, page],
    queryFn: () => api<Response>(`/api/shares?fileId=${fileId}&page=${page}`),
    refetchInterval: 5000,
  });
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['shares'] }),
      client.invalidateQueries({ queryKey: ['files'] }),
      client.invalidateQueries({ queryKey: ['activity'] }),
      client.invalidateQueries({ queryKey: ['analytics'] }),
    ]);
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<{ url: string }>('/api/shares', {
        action: 'create',
        fileId,
        expiresAt: expiry ? new Date(expiry).toISOString() : null,
        password: password || null,
      });
      setUrl(result.url);
      setCopied(false);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not create a share link.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function expire() {
    if (!revoke) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/shares', { action: 'revoke', id: revoke.id });
      setRevoke(null);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not revoke this share.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card file-sharing-panel">
      <div className="sharing-panel-heading">
        <div>
          <h2>
            <Link2 size={17} />
            Sharing &amp; access
          </h2>
          <p>Manage access to this file.</p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setError('');
            setUrl('');
            setExpiry('');
            setPassword('');
            setCreating(true);
          }}
        >
          <Plus size={14} />
          Create link
        </button>
      </div>
      {loadError ? (
        <div className="notice error" role="alert">
          {loadError.message}
          <button className="btn" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : isPending ? (
        <div className="skeleton" style={{ height: 90 }} />
      ) : (
        <>
          <div className="sharing-metrics">
            <span>
              <Link2 size={14} />
              <strong>{data?.totals.activeLinks ?? 0}</strong>active links
            </span>
            <span>
              <Eye size={14} />
              <strong>{data?.totals.views ?? 0}</strong>validated views
            </span>
            <span>
              <Users size={14} />
              <strong>{data?.totals.activeViewers ?? 0}</strong>active viewers
            </span>
            <small>Updates every 5s</small>
          </div>
          {data?.items.length ? (
            <div className="sharing-links">
              {data.items.map((share, index) => (
                <article className="sharing-link" key={share.id}>
                  <div className="sharing-link-top">
                    <strong>
                      Share link {(page - 1) * data.limit + index + 1}
                    </strong>
                    <span
                      className={`share-state ${share.active ? 'is-active' : ''}`}
                    >
                      {share.revokedAt
                        ? 'Revoked'
                        : share.active
                          ? 'Active'
                          : 'Expired'}
                    </span>
                    {share.protected && (
                      <span className="sharing-password">
                        <ShieldCheck size={12} />
                        Password protected
                      </span>
                    )}
                    {share.active && (
                      <button
                        type="button"
                        className="sharing-expire"
                        onClick={() => {
                          setError('');
                          setRevoke(share);
                        }}
                      >
                        Expire now
                      </button>
                    )}
                  </div>
                  <dl>
                    <div>
                      <dt>Shared</dt>
                      <dd>{date(share.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Expires</dt>
                      <dd>
                        {share.revokedAt
                          ? `Revoked ${date(share.revokedAt)}`
                          : share.expiresAt
                            ? date(share.expiresAt)
                            : 'No expiration'}
                      </dd>
                    </div>
                    <div>
                      <dt>Views</dt>
                      <dd>{share.accessCount}</dd>
                    </div>
                    <div>
                      <dt>Active now</dt>
                      <dd>
                        {share.activeViewers}{' '}
                        {share.activeViewers === 1 ? 'viewer' : 'viewers'}
                      </dd>
                    </div>
                    <div>
                      <dt>Last opened</dt>
                      <dd>{date(share.lastAccessedAt)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="sharing-empty">
              <ShieldCheck size={20} />
              <div>
                <strong>This file is private</strong>
                <p>Create a link when you want to share it.</p>
              </div>
            </div>
          )}
          <p className="sharing-footnote">
            Active viewers are authorized, visible browser tabs seen in the last
            45 seconds, not unique people. Views count successful share
            openings.
          </p>
          {data && data.count > data.limit && (
            <nav className="activity-pagination" aria-label="Shared-link pages">
              <button
                className="btn"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <span>
                Page {page} of {Math.ceil(data.count / data.limit)}
              </span>
              <button
                className="btn"
                disabled={page * data.limit >= data.count}
                onClick={() => setPage(page + 1)}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </nav>
          )}
        </>
      )}
      <Dialog
        open={creating}
        onOpenChange={(open) => {
          if (!busy) setCreating(open);
        }}
        title="Share this file"
        description={name}
      >
        {url ? (
          <div className="share-created">
            <ShieldCheck size={22} />
            <p>Link created. Copy it now; it will not be shown again.</p>
            <Input
              placeholder="Your new share link"
              aria-label="New share link"
              readOnly
              value={url}
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              className="btn primary"
              onClick={() =>
                void navigator.clipboard
                  .writeText(url)
                  .then(() => setCopied(true))
                  .catch(() =>
                    setError('Copy failed. Select and copy the link above.'),
                  )
              }
            >
              <Copy size={15} />
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        ) : (
          <form onSubmit={create}>
            <label className="form-field">
              Expiration (optional)
              <DateTimePicker
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
              />
            </label>
            <label className="form-field">
              Password (optional)
              <PasswordInput
                placeholder="Set a password (optional, 8+ characters)"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? (
                  <LoaderCircle size={15} className="vault-spinner" />
                ) : (
                  <Link2 size={15} />
                )}
                Create link
              </button>
            </div>
          </form>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </Dialog>
      <Dialog
        open={Boolean(revoke)}
        onOpenChange={(open) => {
          if (!open && !busy) setRevoke(null);
        }}
        title="Expire this link now?"
        description="This revokes the link and ends future access through it. Your original file stays private and available to you."
      >
        <div className="dialog-actions">
          <button
            className="btn"
            disabled={busy}
            onClick={() => setRevoke(null)}
          >
            Cancel
          </button>
          <button
            className="btn danger"
            disabled={busy}
            onClick={() => void expire()}
          >
            {busy ? (
              <LoaderCircle size={14} className="vault-spinner" />
            ) : (
              <Clock3 size={14} />
            )}
            Expire now
          </button>
        </div>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
      </Dialog>
    </section>
  );
}
