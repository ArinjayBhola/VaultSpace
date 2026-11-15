'use client';
import { typeLabel } from '@/lib/file-types';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  FolderPlus,
  Upload,
  FileText,
  ImageIcon,
  Star,
  Layers3,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { api, bytes } from '@/lib/client';
import { userTimeZone } from '@/lib/time';
import type { Analytics } from '@/types';

export function Overview({
  onUpload,
  onCreateFolder,
}: {
  onUpload: () => void;
  onCreateFolder: () => void;
}) {
  const { data } = useQuery({
    queryKey: ['analytics', userTimeZone()],
    queryFn: () =>
      api<Analytics>(
        '/api/analytics?timezone=' + encodeURIComponent(userTimeZone()),
      ),
  });
  const palette = [
    '#4f7ff0',
    '#a69af1',
    '#4b9e82',
    '#e1a64b',
    '#d17a8b',
    '#6599bd',
  ];
  const distribution = (data?.distribution ?? []).map((entry, index, all) => {
    const total = data?.activeBytes ?? 0;
    const start = total
      ? (all.slice(0, index).reduce((sum, item) => sum + item.bytes, 0) /
          total) *
        100
      : 0;
    return {
      ...entry,
      color: palette[index % palette.length],
      start,
      end: start + (total ? (entry.bytes / total) * 100 : 0),
    };
  });
  const gradient = distribution
    .map((entry) => entry.color + ' ' + entry.start + '% ' + entry.end + '%')
    .join(',');
  return (
    <>
      <section className="overview-welcome">
        <div className="welcome-copy">
          <span className="section-eyebrow">
            <span />
            YOUR PERSONAL WORKSPACE
          </span>
          <h1>
            A little space.
            <br />
            <span>A lot of possibility.</span>
          </h1>
          <p>
            Your documents, memories, and ideas.
            <br className="desktop-break" /> All together, right where you need
            them.
          </p>
          <div className="welcome-actions">
            <button className="btn primary" onClick={onUpload}>
              <Upload size={16} />
              Upload files
              <ArrowUpRight size={14} />
            </button>
            <button className="btn" onClick={onCreateFolder}>
              <FolderPlus size={16} />
              New folder
            </button>
          </div>
          <span className="welcome-assurance">
            <ShieldCheck size={13} />
            Private files. Thoughtfully organized.
          </span>
        </div>
        <div className="welcome-storage">
          <div className="welcome-storage-heading">
            <span>Your storage</span>
            <Link
              href="/analytics"
              aria-label="View storage analytics"
              className="storage-detail-link"
            >
              Details
              <ArrowUpRight size={13} />
            </Link>
          </div>
          <div
            className="storage-donut"
            role="img"
            aria-label={
              data
                ? distribution
                    .map(
                      (entry) =>
                        typeLabel('', entry.type) + ': ' + bytes(entry.bytes),
                    )
                    .join(', ')
                : 'Loading storage breakdown'
            }
            style={{
              background: data?.activeBytes
                ? `conic-gradient(${gradient})`
                : 'var(--border)',
            }}
          >
            <div>
              <strong>{data ? bytes(data.activeBytes) : '—'}</strong>
              <span>active files</span>
            </div>
          </div>
          <div className="storage-donut-legend">
            {distribution.map((entry) => (
              <span key={entry.type}>
                <i style={{ background: entry.color }} />
                {typeLabel('', entry.type)}
                <strong>{bytes(entry.bytes)}</strong>
              </span>
            ))}
          </div>
          <p>
            {data
              ? `${data.thisMonth} ${data.thisMonth === 1 ? 'file' : 'files'} added this month`
              : 'Calculating from your files...'}
          </p>
        </div>
      </section>
      <nav className="quick-access" aria-label="Quick access">
        {[
          {
            href: '/documents',
            name: 'Documents',
            description: 'Your reading room',
            icon: FileText,
            tone: 'amber',
          },
          {
            href: '/search?type=images',
            name: 'Images',
            description: 'The moments you keep',
            icon: ImageIcon,
            tone: 'purple',
          },
          {
            href: '/starred',
            name: 'Starred',
            description: 'Always close at hand',
            icon: Star,
            tone: 'blue',
          },
          {
            href: '/collections',
            name: 'Collections',
            description: 'Bring things together',
            icon: Layers3,
            tone: 'green',
          },
        ].map(({ href, name, description, icon: Icon, tone }) => (
          <Link href={href} className="quick-access-item" key={href}>
            <span className={`quick-access-icon ${tone}`}>
              <Icon size={19} />
            </span>
            <span>
              <strong>{name}</strong>
              <small>{description}</small>
            </span>
            <ArrowRight size={15} />
          </Link>
        ))}
      </nav>
    </>
  );
}
