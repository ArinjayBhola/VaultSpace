'use client';
import { useDateFormatter } from '@/hooks/use-date-formatter';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { FileText, ArrowUpRight, Activity, Clock3 } from 'lucide-react';
import { userTimeZone, timeZoneLabel } from '@/lib/time';
import { activityLabel } from '@/lib/activity-label';
import { api, bytes } from '@/lib/client';
import type { Analytics } from '@/types';
export function AnalyticsPanels({ full = false }: { full?: boolean }) {
  const date = useDateFormatter();
  const { data, error } = useQuery({
    queryKey: ['analytics', userTimeZone()],
    queryFn: () =>
      api<Analytics>(
        '/api/analytics?timezone=' + encodeURIComponent(userTimeZone()),
      ),
  });
  if (error) return <div className="notice error">{error.message}</div>;
  if (!data) return <div className="skeleton" style={{ height: 200 }} />;
  const max = Math.max(1, ...data.timeline.map((d) => d.count));
  const colors = [
    '#3b82f6',
    '#8b5cf6',
    '#10b981',
    '#f59e0b',
    '#ec4899',
    '#64748b',
  ];
  return (
    <>
      <div className="split" style={{ marginTop: 27 }}>
        <section className="card">
          <div
            className="panel-heading"
            style={{ display: 'flex', justifyContent: 'space-between' }}
          >
            <h2 style={{ margin: 0 }}>Upload activity</h2>
            <span
              className="muted"
              style={{
                fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
              }}
            >
              Last 30 days · {timeZoneLabel(data.timeZone)}
            </span>
          </div>
          <div style={{ padding: '10px 22px 20px' }}>
            {data.timeline.some((d) => d.count > 0) ? (
              <>
                <svg
                  viewBox="0 0 580 145"
                  width="100%"
                  height="155"
                  role="img"
                  aria-label="Daily uploads over the last 30 days"
                >
                  <desc>
                    {data.timeline
                      .map((day) => `${date(day.day)}: ${day.count} uploads`)
                      .join('; ')}
                  </desc>
                  <polygon
                    fill="#3b82f610"
                    points={`5,140 ${data.timeline.map((day, index) => `${5 + (index / Math.max(1, data.timeline.length - 1)) * 570},${140 - (day.count / max) * 115}`).join(' ')} 575,140`}
                  />
                  {[20, 60, 100, 140].map((y) => (
                    <line
                      key={y}
                      x1="5"
                      x2="575"
                      y1={y}
                      y2={y}
                      stroke="var(--border)"
                      strokeDasharray="4 4"
                    />
                  ))}
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    points={data.timeline
                      .map(
                        (d, i) =>
                          `${5 + (i / Math.max(1, data.timeline.length - 1)) * 570},${140 - (d.count / max) * 115}`,
                      )
                      .join(' ')}
                  />
                  {data.timeline.map((d, i) => (
                    <circle
                      key={d.day}
                      cx={5 + (i / Math.max(1, data.timeline.length - 1)) * 570}
                      cy={140 - (d.count / max) * 115}
                      r="3"
                      fill="#3b82f6"
                    >
                      <title>
                        {d.day}: {d.count} uploads
                      </title>
                    </circle>
                  ))}
                </svg>
                <div
                  className="muted"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize:
                      'max(9px, calc(12px * var(--vault-font-scale, 1)))',
                  }}
                >
                  <span>{date(data.timeline[0]?.day)}</span>
                  <span>{date(data.timeline.at(-1)?.day ?? null)}</span>
                </div>
              </>
            ) : (
              <div className="empty">
                <Activity size={28} />
                <h3>Your activity starts here</h3>
                <p>Upload your first file to see your storage grow.</p>
              </div>
            )}
          </div>
        </section>
        <section className="card">
          <div className="panel-heading activity-heading">
            <h2 style={{ margin: 0 }}>Recent activity</h2>
            <Link href="/activity" className="link activity-more">
              View more <ArrowUpRight size={16} />
            </Link>
          </div>
          {data.activity.length ? (
            data.activity.slice(0, 3).map((a) => (
              <div className="activity-row" key={a.id}>
                <span
                  className="stat-icon"
                  style={{
                    background: 'var(--soft)',
                    color: 'var(--blue)',
                    flexShrink: 0,
                  }}
                >
                  <Clock3 size={15} />
                </span>
                <div>
                  <div className="activity-event-label">
                    {activityLabel(a.event)}
                  </div>
                  <div className="file-subtitle">{date(a.createdAt)}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty">
              <Clock3 size={26} />
              <p>Your vault history will appear here.</p>
            </div>
          )}
        </section>
      </div>
      {full && (
        <>
          <div className="split" style={{ marginTop: 23 }}>
            <section className="card">
              <div className="panel-heading">
                <h2 style={{ margin: 0 }}>Storage distribution</h2>
              </div>
              <div style={{ padding: 22 }}>
                {data.distribution.length ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        height: 14,
                        borderRadius: 6,
                        overflow: 'hidden',
                        marginBottom: 24,
                      }}
                    >
                      {data.distribution.map((d, i) => (
                        <div
                          key={d.type}
                          style={{
                            width: `${(d.bytes / Math.max(1, data.activeBytes)) * 100}%`,
                            background: colors[i % colors.length],
                          }}
                          title={`${d.type}: ${bytes(d.bytes)}`}
                        />
                      ))}
                    </div>
                    {data.distribution.map((d, i) => (
                      <div
                        key={d.type}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '9px 0',
                          fontSize:
                            'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
                        }}
                      >
                        <span>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: 3,
                              background: colors[i % colors.length],
                              marginRight: 8,
                            }}
                          />
                          {d.type} · {d.count} files
                        </span>
                        <strong>{bytes(d.bytes)}</strong>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="muted">No stored files yet.</p>
                )}
                <p
                  className="muted"
                  style={{
                    fontSize:
                      'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                    margin: '20px 0 0',
                  }}
                >
                  {data.storageLabel}
                </p>
                <div style={{ display: 'flex', gap: 30, marginTop: 20 }}>
                  <div>
                    <div
                      className="muted"
                      style={{
                        fontSize:
                          'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                      }}
                    >
                      In trash
                    </div>
                    <strong>{bytes(data.trashedBytes)}</strong>
                  </div>
                  <div>
                    <div
                      className="muted"
                      style={{
                        fontSize:
                          'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                      }}
                    >
                      Derived assets
                    </div>
                    <strong>{bytes(data.derivedBytes)}</strong>
                  </div>
                  <div>
                    <div
                      className="muted"
                      style={{
                        fontSize:
                          'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                      }}
                    >
                      Uploaded this month
                    </div>
                    <strong>{data.thisMonth}</strong>
                  </div>
                </div>
              </div>
            </section>
            <section className="card">
              <div className="panel-heading">
                <h2 style={{ margin: 0 }}>Largest files</h2>
              </div>
              {data.largest.length ? (
                data.largest.map((f) => (
                  <Link
                    className="activity-row"
                    href={
                      f.mimeType === 'application/pdf'
                        ? `/documents/${f.id}`
                        : `/search?q=${encodeURIComponent(f.name)}`
                    }
                    key={f.id}
                  >
                    <FileText size={18} color="#2563eb" />
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.name}
                    </span>
                    <span className="muted">{bytes(f.size)}</span>
                    <ArrowUpRight size={13} />
                  </Link>
                ))
              ) : (
                <div className="empty">
                  <p>No files yet.</p>
                </div>
              )}
            </section>
          </div>
          <p
            className="muted"
            style={{
              fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
              marginTop: 18,
            }}
          >
            Last updated {date(data.updatedAt)} · Totals are logical sizes, not
            exact billed R2 storage.
          </p>
        </>
      )}
    </>
  );
}
