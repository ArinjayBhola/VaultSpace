'use client';
import { useDateFormatter } from '@/hooks/use-date-formatter';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import type { Analytics } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock3,
  ChevronLeft,
  ChevronRight,
  Trash2,
  LoaderCircle,
} from 'lucide-react';
import { activityLabel } from '@/lib/activity-label';
import { api } from '@/lib/client';
import { QUERY_STALE_TIME } from '@/lib/cache-policy';
type ActivityPage = {
  items: {
    id: string;
    event: string;
    createdAt: string;
    fileName: string | null;
  }[];
  page: number;
  total: number;
  pages: number;
};
function pageNumbers(
  page: number,
  total: number,
): (number | 'start-gap' | 'end-gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, 'end-gap', total];
  if (page >= total - 3)
    return [1, 'start-gap', total - 4, total - 3, total - 2, total - 1, total];
  return [1, 'start-gap', page - 1, page, page + 1, 'end-gap', total];
}
export function ActivityHistory() {
  const router = useRouter();
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clearError, setClearError] = useState('');
  const [notice, setNotice] = useState('');
  const clearing = useRef(false);
  const date = useDateFormatter();
  const params = useSearchParams();
  const raw = Number(params.get('page') || 1);
  const requestedPage =
    Number.isInteger(raw) && raw > 0 && raw <= 100000 ? raw : 1;
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['activity', requestedPage],
    queryFn: () => api<ActivityPage>(`/api/activity?page=${requestedPage}`),
    refetchInterval: QUERY_STALE_TIME,
  });
  const page = data?.page ?? requestedPage;
  const pages = data?.pages ?? 1;
  function pageHref(target: number) {
    const next = new URLSearchParams(params.toString());
    if (target === 1) next.delete('page');
    else next.set('page', String(target));
    return '/activity' + (next.size ? '?' + next.toString() : '');
  }
  useEffect(() => {
    if (data && data.page !== requestedPage) {
      const next = new URLSearchParams(params.toString());
      if (data.page === 1) next.delete('page');
      else next.set('page', String(data.page));
      router.replace('/activity' + (next.size ? '?' + next.toString() : ''), {
        scroll: false,
      });
    }
  }, [data, requestedPage, params, router]);
  async function clearActivity() {
    if (clearing.current) return;
    clearing.current = true;
    setBusy(true);
    setClearError('');
    try {
      const result = await api<{ deletedCount: number }>('/api/activity', {
        action: 'clear',
      });
      await client.cancelQueries({ queryKey: ['activity'] });
      client.setQueriesData<ActivityPage>(
        { queryKey: ['activity'] },
        (current) =>
          current ? { items: [], total: 0, page: 1, pages: 1 } : current,
      );
      client.setQueryData<ActivityPage>(['activity', 1], {
        items: [],
        total: 0,
        page: 1,
        pages: 1,
      });
      client.setQueriesData<Analytics>(
        { queryKey: ['analytics'] },
        (current) => (current ? { ...current, activity: [] } : current),
      );
      setConfirm(false);
      setNotice(
        result.deletedCount
          ? 'Activity history cleared.'
          : 'No saved activity to clear.',
      );
      router.replace(pageHref(1), { scroll: false });
      void Promise.all([
        client.invalidateQueries({ queryKey: ['activity'] }),
        client.invalidateQueries({ queryKey: ['analytics'] }),
      ]);
    } catch (cause) {
      setClearError(
        cause instanceof Error
          ? cause.message
          : 'Could not clear activity. Try again.',
      );
    } finally {
      clearing.current = false;
      setBusy(false);
    }
  }
  if (isPending)
    return (
      <div
        className="skeleton"
        style={{ height: 340 }}
        aria-label="Loading activity"
      />
    );
  if (error && !data)
    return (
      <div className="notice error" role="alert">
        {error.message}
        <button className="btn" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  return (
    <section className="card">
      <div className="panel-heading activity-panel-heading">
        <h2 style={{ margin: 0 }}>Activity history</h2>
        <div className="activity-heading-actions">
          <span className="muted">{data?.total ?? 0} events</span>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setClearError('');
              setConfirm(true);
            }}
          >
            <Trash2 size={15} />
            Clear activity
          </button>
        </div>
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error.message}
          <button type="button" className="btn" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      )}
      {data?.items.length ? (
        data.items.map((item) => (
          <div className="activity-row" key={item.id}>
            <span
              className="stat-icon"
              style={{
                background: 'var(--soft)',
                color: 'var(--blue)',
                flexShrink: 0,
              }}
            >
              <Clock3 size={17} />
            </span>
            <div>
              <div className="activity-event-label">
                {activityLabel(item.event)}
              </div>
              {item.fileName && <div className="muted">{item.fileName}</div>}
              <time className="file-subtitle" dateTime={item.createdAt}>
                {date(item.createdAt)}
              </time>
            </div>
          </div>
        ))
      ) : (
        <div className="empty">
          <Clock3 size={28} />
          <h3>No activity yet</h3>
          <p>Your vault history will appear here.</p>
        </div>
      )}
      <nav className="activity-pagination" aria-label="Activity pages">
        {page > 1 ? (
          <Link
            className="btn"
            href={pageHref(page - 1)}
            prefetch={false}
            scroll={false}
          >
            <ChevronLeft size={16} />
            Previous
          </Link>
        ) : (
          <button className="btn" disabled>
            <ChevronLeft size={16} />
            Previous
          </button>
        )}
        <div className="activity-page-numbers">
          {pageNumbers(page, pages).map((item) =>
            typeof item === 'number' ? (
              <Link
                key={item}
                prefetch={false}
                scroll={false}
                className={
                  'btn activity-page-number' +
                  (item === page ? ' is-current' : '')
                }
                href={pageHref(item)}
                aria-label={'Page ' + item}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </Link>
            ) : (
              <span key={item} className="activity-page-gap" aria-hidden="true">
                ...
              </span>
            ),
          )}
        </div>
        {data && page < data.pages ? (
          <Link
            className="btn"
            href={pageHref(page + 1)}
            prefetch={false}
            scroll={false}
          >
            Next
            <ChevronRight size={16} />
          </Link>
        ) : (
          <button className="btn" disabled>
            Next
            <ChevronRight size={16} />
          </button>
        )}
      </nav>
      <Dialog
        open={confirm}
        onOpenChange={(open) => {
          if (!busy) setConfirm(open);
        }}
        title="Clear activity history?"
        description="All saved activity entries will be permanently removed. Your files, folders, collections and shared links are unaffected. New actions will continue to appear in activity history."
      >
        {clearError && (
          <p className="notice error" role="alert">
            {clearError}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={busy}
            onClick={() => void clearActivity()}
          >
            {busy && <LoaderCircle size={16} className="vault-spinner" />}
            {busy ? 'Clearing...' : 'Clear activity'}
          </button>
        </div>
      </Dialog>
    </section>
  );
}
