'use client';
import { useDateFormatter } from '@/hooks/use-date-formatter';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Clock3, ChevronLeft, ChevronRight } from 'lucide-react';
import { activityLabel } from '@/lib/activity-label';
import { api } from '@/lib/client';
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
export function ActivityHistory() {
  const date = useDateFormatter();
  const params = useSearchParams();
  const raw = Number(params.get('page') || 1);
  const page = Number.isInteger(raw) && raw > 0 && raw <= 100000 ? raw : 1;
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['activity', page],
    queryFn: () => api<ActivityPage>(`/api/activity?page=${page}`),
    refetchInterval: 30000,
  });
  if (isPending)
    return (
      <div
        className="skeleton"
        style={{ height: 340 }}
        aria-label="Loading activity"
      />
    );
  if (error)
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
      <div className="panel-heading">
        <h2 style={{ margin: 0 }}>Activity history</h2>
        <span className="muted">{data?.total ?? 0} events</span>
      </div>
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
          <h3>No activity on this page</h3>
          <p>Your vault history will appear here.</p>
        </div>
      )}
      <nav className="activity-pagination" aria-label="Activity pages">
        {page > 1 ? (
          <Link className="btn" href={`/activity?page=${page - 1}`}>
            <ChevronLeft size={16} />
            Previous
          </Link>
        ) : (
          <button className="btn" disabled>
            <ChevronLeft size={16} />
            Previous
          </button>
        )}
        <span className="muted">
          Page {page} of {data?.pages ?? 1}
        </span>
        {data && page < data.pages ? (
          <Link className="btn" href={`/activity?page=${page + 1}`}>
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
    </section>
  );
}
