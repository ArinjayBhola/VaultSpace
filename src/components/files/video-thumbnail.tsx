/* eslint-disable @next/next/no-img-element -- Private thumbnails require the owner's session. */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Film } from 'lucide-react';
import { thumbnailUrl } from '@/lib/file-content-url';
import { extensionOf, typeLabel } from '@/lib/file-types';
import type { VaultFile } from '@/types';
import './video-thumbnail.css';

export function VideoThumbnail({ file }: { file: VaultFile }) {
  const root = useRef<HTMLDivElement>(null);
  const client = useQueryClient();
  const [failedSource, setFailedSource] = useState('');
  const source = thumbnailUrl(file);
  useEffect(() => {
    const element = root.current;
    if (!element || file.hasThumbnail) return;
    const prepare = () => {
      void import('@/lib/video-thumbnail')
        .then(async ({ ensureVideoThumbnail, refreshVideoThumbnails }) => {
          if (await ensureVideoThumbnail(file)) refreshVideoThumbnails(client);
        })
        .catch(() => {});
    };
    if (!('IntersectionObserver' in window)) {
      prepare();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        prepare();
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [file, client]);
  return (
    <div ref={root} className="video-thumbnail-preview">
      {file.hasThumbnail && source !== failedSource ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          onError={() => setFailedSource(source)}
        />
      ) : (
        <>
          <Film size={38} strokeWidth={1.25} />
          <span>
            {typeLabel(extensionOf(file.originalFilename), file.mimeType)}
          </span>
        </>
      )}
    </div>
  );
}
