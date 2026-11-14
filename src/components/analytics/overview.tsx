'use client';
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
  const images =
    data?.distribution
      .filter((item) => item.type.startsWith('image/'))
      .reduce((sum, item) => sum + item.bytes, 0) ?? 0;
  const documents =
    data?.distribution
      .filter((item) => item.type === 'application/pdf')
      .reduce((sum, item) => sum + item.bytes, 0) ?? 0;
  const ratio = data?.activeBytes ? (images / data.activeBytes) * 100 : 0;
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
                ? `${bytes(images)} in images and ${bytes(documents)} in PDFs`
                : 'Loading storage breakdown'
            }
            style={{
              background: data?.activeBytes
                ? `conic-gradient(#4f7ff0 0% ${ratio}%,#a69af1 ${ratio}% 100%)`
                : 'var(--border)',
            }}
          >
            <div>
              <strong>{data ? bytes(data.activeBytes) : '—'}</strong>
              <span>active files</span>
            </div>
          </div>
          <div className="storage-donut-legend">
            <span>
              <i style={{ background: '#4f7ff0' }} />
              Images<strong>{data ? bytes(images) : '—'}</strong>
            </span>
            <span>
              <i style={{ background: '#a69af1' }} />
              Documents<strong>{data ? bytes(documents) : '—'}</strong>
            </span>
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
