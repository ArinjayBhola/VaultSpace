'use client';
import { useDateFormatter } from '@/hooks/use-date-formatter';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, File, Calendar, HardDrive } from 'lucide-react';
import { api, bytes } from '@/lib/client';
import type { VaultFile } from '@/types';
import { FileSharing } from '@/components/sharing/file-sharing';
const ContentPreview = dynamic(
  () => import('./content-preview').then((module) => module.ContentPreview),
  {
    ssr: false,
    loading: () => <div className="skeleton" style={{ height: 360 }} />,
  },
);
export function FileWorkspace({ id }: { id: string }) {
  const date = useDateFormatter();
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
        <a className="btn primary" href={'/api/files/' + id + '/download'}>
          <Download size={16} />
          Download
        </a>
      </div>
      <div className="file-workspace-layout">
        <section className="card file-preview-panel" aria-label="File preview">
          <ContentPreview
            url={'/api/files/' + id + '/content'}
            name={file.displayName}
            mimeType={file.mimeType}
            size={file.sizeBytes}
          />
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
      <FileSharing
        fileId={id}
        name={file.displayName}
        folderProtected={file.folderProtected}
      />
    </div>
  );
}
