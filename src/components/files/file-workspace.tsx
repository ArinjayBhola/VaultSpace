'use client';
import { useDateFormatter } from '@/hooks/use-date-formatter';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { canPreviewFile, rasterTypes } from '@/lib/file-types';
import { ImageLightbox } from './image-lightbox';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  File,
  Calendar,
  HardDrive,
  Maximize2,
  Eye,
} from 'lucide-react';
import { api, bytes } from '@/lib/client';
import type { VaultFile } from '@/types';
import { FileSharing } from '@/components/sharing/file-sharing';
import { FileMetadataEditor } from './metadata-editor';
const ContentPreview = dynamic(
  () => import('./content-preview').then((module) => module.ContentPreview),
  {
    ssr: false,
    loading: () => <div className="skeleton" style={{ height: 360 }} />,
  },
);
export function FileWorkspace({ id }: { id: string }) {
  const date = useDateFormatter();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { data, error } = useQuery({
    queryKey: ['file-details', id],
    queryFn: ({ signal }) =>
      api<{ file: VaultFile }>('/api/files/' + id, undefined, 'GET', signal),
  });
  if (error)
    return (
      <div className="notice error" role="alert">
        {error.message}
      </div>
    );
  if (!data) return <div className="skeleton" style={{ height: 400 }} />;
  const file = data.file;
  const supported = canPreviewFile(
    file.displayName,
    file.mimeType,
    file.sizeBytes,
  );
  const expanded = previewId === id && supported;
  return (
    <div className="file-workspace">
      <Link href="/files" className="link file-back">
        <ArrowLeft size={16} />
        My files
      </Link>
      <div className="page-heading">
        <div>
          <span className="section-eyebrow">FILE WORKSPACE</span>
          <h1>{file.displayName}</h1>
          <p>{file.description || 'Your original file is stored privately.'}</p>
        </div>
        <div className="file-page-actions">
          <FileMetadataEditor key={file.id} file={file} />
          <a className="btn primary" href={'/api/files/' + id + '/download'}>
            <Download size={16} />
            Download
          </a>
        </div>
      </div>
      <div className="file-workspace-layout">
        <section className="card file-preview-panel" aria-label="File preview">
          <div className="file-preview-heading">
            <h2>Preview</h2>
            {supported && (
              <button
                type="button"
                className="btn"
                onClick={() => setPreviewId(id)}
              >
                <Maximize2 size={16} />
                Expand preview
              </button>
            )}
          </div>
          {expanded ? (
            <div className="empty">
              <Eye size={28} />
              <p>Preview is open in the popup.</p>
            </div>
          ) : (
            <ContentPreview
              url={'/api/files/' + id + '/content'}
              name={file.displayName}
              mimeType={file.mimeType}
              size={file.sizeBytes}
              onExpand={supported ? () => setPreviewId(id) : undefined}
            />
          )}
        </section>
        <aside className="card file-metadata">
          <h2>File details</h2>
          <dl>
            <dt>
              <File size={15} />
              Type
            </dt>
            <dd>{file.mimeType}</dd>
            <dt>
              <HardDrive size={15} />
              Size
            </dt>
            <dd>{bytes(file.sizeBytes)}</dd>
            <dt>
              <Calendar size={15} />
              Uploaded
            </dt>
            <dd>{date(file.createdAt)}</dd>
            <dt>Modified</dt>
            <dd>{date(file.updatedAt)}</dd>
          </dl>
        </aside>
      </div>
      {supported && rasterTypes.includes(file.mimeType) && expanded && (
        <ImageLightbox
          url={'/api/files/' + id + '/content'}
          name={file.displayName}
          onClose={() => setPreviewId(null)}
        />
      )}
      {supported && !rasterTypes.includes(file.mimeType) && (
        <Dialog
          open={expanded}
          onOpenChange={(open) => {
            if (!open) setPreviewId(null);
          }}
          title={file.displayName}
          description={bytes(file.sizeBytes) + ' - File preview'}
          className="file-preview-dialog"
        >
          <div className="file-preview-dialog-body">
            <ContentPreview
              key={file.id}
              url={'/api/files/' + id + '/content'}
              name={file.displayName}
              mimeType={file.mimeType}
              size={file.sizeBytes}
            />
          </div>
          <div className="file-preview-dialog-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setPreviewId(null)}
            >
              Close preview
            </button>
            <a className="btn primary" href={'/api/files/' + id + '/download'}>
              <Download size={16} />
              Download original
            </a>
          </div>
        </Dialog>
      )}
      <FileSharing
        fileId={id}
        name={file.displayName}
        folderProtected={file.folderProtected}
      />
    </div>
  );
}
