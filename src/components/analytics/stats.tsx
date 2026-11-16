'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Files,
  ImageIcon,
  FileText,
  HardDrive,
  ArrowUpRight,
} from 'lucide-react';
import { userTimeZone } from '@/lib/time';
import { api, bytes } from '@/lib/client';
import type { Analytics } from '@/types';
export function Stats() {
  const { data, error, isPending } = useQuery({
    queryKey: ['analytics', userTimeZone()],
    queryFn: () =>
      api<Analytics>(
        '/api/analytics?timezone=' + encodeURIComponent(userTimeZone()),
      ),
  });
  if (error)
    return (
      <div className="notice error" role="alert">
        Storage data unavailable: {error.message}
      </div>
    );
  const stats = [
    {
      href: '/files',
      label: 'Total files',
      value: data?.totalFiles,
      caption: 'Everything in your vault',
      icon: Files,
      color: '#2563eb',
      bg: '#eff6ff',
    },
    {
      href: '/search?type=images',
      label: 'Images',
      value: data?.images,
      caption: 'Your visual collection',
      icon: ImageIcon,
      color: '#8b5cf6',
      bg: '#f5f3ff',
    },
    {
      href: '/documents',
      label: 'Documents',
      value: data?.pdfs,
      caption: 'PDFs, organized and searchable',
      icon: FileText,
      color: '#f59e0b',
      bg: '#fffbeb',
    },
    {
      href: '/analytics',
      label: 'Storage used',
      value: data ? bytes(data.activeBytes) : undefined,
      caption: 'Logical active-file storage',
      icon: HardDrive,
      color: '#10b981',
      bg: '#ecfdf5',
    },
  ];
  return (
    <div className="stats">
      {stats.map(({ href, label, value, caption, icon: Icon, color, bg }) => (
        <Link href={href} className="card stat" key={label}>
          <div className="stat-top">
            <span>{label}</span>
            <span className="stat-icon" style={{ color, background: bg }}>
              <Icon size={17} />
            </span>
          </div>
          <div className="stat-value">
            {isPending ? (
              <div className="skeleton" style={{ height: 30, width: 65 }} />
            ) : (
              value
            )}
          </div>
          <div className="stat-caption">
            {caption}
            <ArrowUpRight size={12} />
          </div>
        </Link>
      ))}
    </div>
  );
}
