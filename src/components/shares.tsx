'use client';
import Link from 'next/link';
import { Select } from '@/components/ui/select';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link2,
  ShieldCheck,
  LockKeyhole,
  X,
  Eye,
  Users,
  ArrowUpRight,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { api, date } from '@/lib/client';
import { Dialog } from '@/components/ui/dialog';
type Share = {
  url: string | null;
  endedAt: string | null;
  visibleUntil: string | null;
  id: string;
  fileId: string;
  filename: string;
  mimeType: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  protected: boolean;
  active: boolean;
  activeViewers: number;
};
export function Shares() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const { data, error, isPending } = useQuery({
    queryKey: ['shares', page, status],
    queryFn: () =>
      api<{
        items: Share[];
        count: number;
        page: number;
        limit: number;
        totals: { activeLinks: number; views: number; activeViewers: number };
      }>('/api/shares?page=' + page + '&status=' + status),
    refetchInterval: 5000,
  });
  const [revoke, setRevoke] = useState<Share | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [copied, setCopied] = useState('');
  async function copyLink(share: Share) {
    if (!share.url) return;
    setActionError('');
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(share.id);
    } catch {
      setActionError(
        'Could not copy the link. Open it and copy the URL from your browser.',
      );
    }
  }
  async function confirm() {
    if (!revoke) return;
    setBusy(true);
    try {
      await api('/api/shares', { action: 'revoke', id: revoke.id });
      await Promise.all(
        ['shares', 'files', 'file-details', 'activity', 'analytics'].map(
          (key) => client.invalidateQueries({ queryKey: [key] }),
        ),
      );
      setRevoke(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Revocation failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {actionError && !revoke && (
        <p role="alert" className="notice error">
          {actionError}
        </p>
      )}
      {copied && (
        <p role="status" className="muted">
          Share link copied.
        </p>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error.message}
        </div>
      )}
      <div
        className="sharing-overview"
        aria-label="Sharing within the current filter"
      >
        {[
          {
            label: 'Active links',
            value: data?.totals.activeLinks,
            icon: Link2,
            tone: 'blue',
          },
          {
            label: 'Validated views',
            value: data?.totals.views,
            icon: Eye,
            tone: 'purple',
          },
          {
            label: 'Viewing sessions',
            value: data?.totals.activeViewers,
            icon: Users,
            tone: 'green',
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div className="card sharing-summary" key={label}>
            <span className={`quick-access-icon ${tone}`}>
              <Icon size={19} />
            </span>
            <div>
              <strong>{value ?? '\u2014'}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="sharing-overview-caption">
        Counts reflect the current filter. Live sessions update every five
        seconds.
      </p>
      <div
        className="notice"
        style={{
          background: 'var(--soft)',
          color: 'var(--blue)',
          borderColor: 'var(--border)',
        }}
      >
        <ShieldCheck
          size={15}
          style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }}
        />
        Active links stay listed. Revoked and expired links remain visible for
        24 hours after access ends. Each file can have one active link.
      </div>
      <div className="toolbar">
        <span
          className="muted"
          style={{
            fontSize: 'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
          }}
        >
          {data?.count ?? '?'} links
        </span>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
          }}
        >
          Show
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {['all', 'active', 'expired', 'revoked'].map((value) => (
              <option key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {isPending ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : data?.items.length ? (
        <div className="card table-wrap shares-table">
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Status</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Views / live</th>
                <th>Last accessed</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id}>
                  <td data-label="File">
                    <span
                      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                    >
                      {s.protected ? (
                        <LockKeyhole size={15} color="#2563eb" />
                      ) : (
                        <Link2 size={15} color="#2563eb" />
                      )}
                      <Link
                        className="shared-file-link"
                        href={
                          s.mimeType === 'application/pdf'
                            ? `/documents/${s.fileId}`
                            : `/files/${s.fileId}`
                        }
                      >
                        {s.filename}
                        <ArrowUpRight size={12} />
                      </Link>
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge share-status ${s.active ? 'active' : s.revokedAt ? 'revoked' : 'expired'}`}
                    >
                      {s.active
                        ? 'Active'
                        : s.revokedAt
                          ? 'Revoked'
                          : 'Expired'}
                    </span>
                  </td>
                  <td data-label="Created">{date(s.createdAt)}</td>
                  <td data-label="Expires">
                    {s.expiresAt ? date(s.expiresAt) : 'No expiration'}
                  </td>
                  <td data-label="Views / live">
                    <span className="shared-view-count">
                      {s.accessCount} views
                      <small>{s.activeViewers} active</small>
                    </span>
                  </td>
                  <td data-label="Last opened">{date(s.lastAccessedAt)}</td>
                  <td>
                    <div className="share-link-actions">
                      {s.url ? (
                        <>
                          <a
                            className="btn"
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={
                              'Open ' +
                              (s.active
                                ? 'active'
                                : s.revokedAt
                                  ? 'revoked'
                                  : 'expired') +
                              ' share link for ' +
                              s.filename
                            }
                          >
                            <ExternalLink size={14} />
                            Open link
                          </a>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => void copyLink(s)}
                            aria-label={'Copy share link for ' + s.filename}
                          >
                            <Copy size={14} />
                            {copied === s.id ? 'Copied' : 'Copy link'}
                          </button>
                        </>
                      ) : (
                        <span className="muted legacy-share-note">
                          Original URL unavailable for this older link
                        </span>
                      )}
                      {s.active && (
                        <button
                          className="btn danger"
                          onClick={() => {
                            setActionError('');
                            setRevoke(s);
                          }}
                        >
                          <X size={13} />
                          Revoke
                        </button>
                      )}
                    </div>
                    {s.visibleUntil && (
                      <small className="shared-history-until">
                        Visible until {date(s.visibleUntil)}
                      </small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card empty">
          <Link2 size={36} />
          <h3>Your files stay private</h3>
          <p>
            Share a selected file when you’re ready.
            <br />
            You control the password, expiration, and access.
          </p>
        </div>
      )}
      {data && data.count > data.limit && (
        <div className="pagination">
          <span>
            Page {page} of {Math.ceil(data.count / data.limit)}
          </span>
          <div>
            <button
              className="btn"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              className="btn"
              disabled={page * data.limit >= data.count}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
      <Dialog
        open={Boolean(revoke)}
        onOpenChange={(open) => {
          if (!open) setRevoke(null);
        }}
        title="Revoke this link?"
        description={`Access to “${revoke?.filename ?? ''}” will stop immediately, including existing file grants.`}
      >
        {actionError && (
          <div className="notice error" role="alert">
            {actionError}
          </div>
        )}
        <div className="dialog-actions">
          <button
            className="btn"
            onClick={() => setRevoke(null)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="btn danger"
            onClick={() => void confirm()}
            disabled={busy}
          >
            {busy ? 'Revoking…' : 'Revoke access'}
          </button>
        </div>
      </Dialog>
    </>
  );
}
