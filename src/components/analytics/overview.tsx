'use client';
import { typeLabel } from '@/lib/file-types';
import { useState } from 'react';
import { storageColor, storageArc } from '@/lib/storage-chart';
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
  const [activeType, setActiveType] = useState<string | null>(null);
  const distribution = (data?.distribution ?? []).map((entry, index, all) => {
    const total = data?.activeBytes ?? 0;
    const start = total
      ? (all.slice(0, index).reduce((sum, item) => sum + item.bytes, 0) /
          total) *
        100
      : 0;
    return {
      ...entry,
      color: storageColor(index),
      start,
      end: start + (total ? (entry.bytes / total) * 100 : 0),
    };
  });
  const active = distribution.find((entry) => entry.type === activeType);
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
            role="group"
            aria-label="Storage by file type"
            onPointerLeave={() => setActiveType(null)}
          >
            <svg
              viewBox="0 0 100 100"
              className="storage-donut-segments"
              aria-label={
                data
                  ? 'Hover or focus a segment for its file type'
                  : 'Loading storage breakdown'
              }
            >
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="var(--border)"
                strokeWidth="8"
              />
              {distribution
                .filter((entry) => entry.bytes > 0)
                .map((entry) => {
                  const label = `${typeLabel('', entry.type)} · ${bytes(entry.bytes)} · ${entry.count} ${entry.count === 1 ? 'file' : 'files'}`;
                  return (
                    <path
                      key={entry.type}
                      className="storage-donut-segment"
                      d={storageArc(entry.start, entry.end)}
                      fill="none"
                      stroke={entry.color}
                      strokeWidth="8"
                      tabIndex={0}
                      role="img"
                      aria-label={label}
                      onPointerEnter={() => setActiveType(entry.type)}
                      onPointerLeave={() => setActiveType(null)}
                      onFocus={() => setActiveType(entry.type)}
                      onBlur={() => setActiveType(null)}
                      onClick={() => setActiveType(entry.type)}
                    >
                      <title>{label}</title>
                    </path>
                  );
                })}
            </svg>
            <div className="storage-donut-center">
              <strong>
                {active
                  ? bytes(active.bytes)
                  : data
                    ? bytes(data.activeBytes)
                    : '—'}
              </strong>
              <span>
                {active ? typeLabel('', active.type) : 'active files'}
              </span>
            </div>
          </div>
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
