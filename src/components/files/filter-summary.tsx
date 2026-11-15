'use client';

import { Tooltip } from '@/components/ui/tooltip';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { bytes } from '@/lib/client';
import { localDateLabel, localDateValue } from '@/lib/time';
export const fileFilterKeys = [
  'q',
  'type',
  'starred',
  'after',
  'before',
  'minSize',
  'maxSize',
  'folder',
  'collection',
  'status',
] as const;
export function FilterSummary({
  folderName,
  collectionName,
}: {
  folderName?: string;
  collectionName?: string;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const active = fileFilterKeys.flatMap((key) => {
    const value = params.get(key);
    if (!value || (key === 'type' && value === 'all')) return [];
    const labels: Record<string, string> = {
      q: `Search: ${value}`,
      type:
        value === 'images'
          ? 'Images only'
          : value.startsWith('mime:')
            ? value.slice(5)
            : value.toUpperCase(),
      starred: value === 'true' ? 'Starred only' : 'Not starred',
      after: `From ${localDateLabel(localDateValue(value))}`,
      before: `Until ${localDateLabel(localDateValue(value))}`,
      minSize: `At least ${bytes(Number(value))}`,
      maxSize: `Up to ${bytes(Number(value))}`,
      folder: `Folder: ${folderName || 'Selected folder'}`,
      collection: `Collection: ${collectionName || 'Selected collection'}`,
      status: `Status: ${value.replaceAll('_', ' ')}`,
    };
    return [{ key, label: labels[key] }];
  });
  function remove(key?: string) {
    const next = new URLSearchParams(params.toString());
    for (const field of key ? [key] : fileFilterKeys) next.delete(field);
    next.delete('page');
    router.replace(`${pathname}${next.size ? '?' + next.toString() : ''}`);
  }
  if (!active.length) return null;
  return (
    <div className="filter-summary" aria-label="Active file filters">
      <span className="filter-summary-label">Filtered by</span>
      {active.map((item) => (
        <Tooltip key={item.key} label={`Remove ${item.label}`}>
          <button
            type="button"
            className="filter-chip"
            key={item.key}

            aria-label={`Remove ${item.label}`}
            onClick={() => remove(item.key)}
          >
            <span>{item.label}</span>
            <X size={12} />
          </button>
        </Tooltip>
      ))}
      <button type="button" className="filter-clear" onClick={() => remove()}>
        Clear all
      </button>
    </div>
  );
}
