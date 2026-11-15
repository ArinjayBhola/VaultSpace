/* eslint-disable @next/next/no-img-element -- Private preview URLs require the owner's session. */
'use client';

import { Tooltip } from '@/components/ui/tooltip';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Clock3,
  Download,
  FileText,
  ImageIcon,
  Link2,
  LoaderCircle,
  RefreshCw,
  ArrowUpRight,
  AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { api, bytes, date } from '@/lib/client';
import type { VaultFile } from '@/types';
type Details = {
  file: VaultFile;
  processingError: string | null;
};
export function FileDetails({
  file: initial,
  onShare,
}: {
  file: VaultFile;
  onShare: (file: VaultFile) => void;
}) {
  const client = useQueryClient();
  const [zoom, setZoom] = useState(1);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');
  const { data, error, refetch, isFetching } = useQuery({
    queryKey: ['file-details', initial.id],
    queryFn: () => api<Details>(`/api/files/${initial.id}`),
    initialData: {
      file: initial,
      processingError: null,
    },
    refetchInterval: (query) =>
      ['pending', 'processing'].includes(
        query.state.data?.file.processingStatus ?? 'pending',
      )
        ? 3000
        : false,
  });
  const file = data.file;
  const pdf = file.mimeType === 'application/pdf';
  const waiting = file.processingStatus === 'pending';
  const preparing = file.processingStatus === 'processing';
  const ready = file.processingStatus === 'ready';
  const stage = ready
    ? 'Ready'
    : waiting
      ? 'Queued'
      : preparing
        ? 'Preparing'
        : file.processingStatus === 'password_required'
          ? 'Password required'
          : file.processingStatus === 'corrupt_pdf'
            ? 'Could not read PDF'
            : file.processingStatus === 'limit_exceeded'
              ? 'Preparation limit'
              : 'Needs attention';
  async function retry() {
    setRetrying(true);
    setRetryError('');
    try {
      await api('/api/files', {
        operation: 'bulk',
        ids: [file.id],
        action: 'reprocess',
      });
      window.dispatchEvent(new Event('vault-operations'));
      await Promise.all([
        refetch(),
        client.invalidateQueries({ queryKey: ['files'] }),
        client.invalidateQueries({ queryKey: ['settings'] }),
      ]);
    } catch (cause) {
      setRetryError(
        cause instanceof Error
          ? cause.message
          : 'Preparation could not be retried.',
      );
    } finally {
      setRetrying(false);
    }
  }
  if (error)
    return (
      <div className="notice error" role="alert">
        {error.message}
        <button className="btn" onClick={() => void refetch()}>
          Refresh details
        </button>
      </div>
    );
  return (
    <div className="file-details">
      <div className={`details-preview ${pdf ? 'is-document' : ''}`}>
        {pdf ? (
          <>
            <span className="details-document-mark">
              <FileText size={46} strokeWidth={1.5} />
            </span>
            <span className="details-format">PDF DOCUMENT</span>
          </>
        ) : (
          <div className="details-image-viewport">
            <img
              alt={file.displayName}
              src={`/api/files/${file.id}/content`}
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        )}
        {pdf && file.hasThumbnail && (
          <img
            className="details-page-preview"
            src={`/api/files/${file.id}/content?thumbnail=1`}
            alt="First-page preview"
          />
        )}
      </div>
      {!pdf && (
        <label className="details-zoom">
          Zoom{' '}
          <Input
            aria-label="Image zoom"
            type="range"
            min="1"
            max="3"
            step="0.25"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <span>{Math.round(zoom * 100)}%</span>
        </label>
      )}
      <div className="details-heading">
        <div>
          <h3 title={file.displayName}>{file.displayName}</h3>
          <p>
            {file.description ||
              'Add a description from the file menu to keep useful context close.'}
          </p>
        </div>
        <Tooltip label="Refresh file details">
          <button
            className="icon-btn"
            aria-label="Refresh file details"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw
              size={15}
              className={isFetching ? 'vault-spinner' : undefined}
            />
          </button>
        </Tooltip>
      </div>
      <dl className="details-facts">
        <div>
          <dt>File type</dt>
          <dd>
            {pdf ? <FileText size={14} /> : <ImageIcon size={14} />}{' '}
            {pdf
              ? 'PDF document'
              : file.mimeType.replace('image/', '').toUpperCase() + ' image'}
          </dd>
        </div>
        <div>
          <dt>File size</dt>
          <dd>{bytes(file.sizeBytes)}</dd>
        </div>
        {pdf && (
          <div>
            <dt>Pages</dt>
            <dd>{file.pageCount ?? 'Available after preparation'}</dd>
          </div>
        )}
        {!pdf && file.width && file.height && (
          <div>
            <dt>Dimensions</dt>
            <dd>
              {file.width} × {file.height} px
            </dd>
          </div>
        )}
        <div>
          <dt>Uploaded</dt>
          <dd>{date(file.createdAt)}</dd>
        </div>
        <div>
          <dt>Last modified</dt>
          <dd>{date(file.updatedAt)}</dd>
        </div>
      </dl>
      <section
        className={`details-preparation ${ready ? 'is-ready' : waiting || preparing ? 'is-pending' : 'needs-attention'}`}
        aria-live="polite"
      >
        <div className="details-preparation-title">
          <span>{pdf ? 'PDF thumbnail' : 'Image preview'}</span>
          <span className="details-status">
            {ready ? (
              <Check size={13} />
            ) : preparing ? (
              <LoaderCircle size={13} className="vault-spinner" />
            ) : waiting ? (
              <Clock3 size={13} />
            ) : (
              <AlertCircle size={13} />
            )}{' '}
            {stage}
          </span>
        </div>
        <p>
          {ready
            ? pdf
              ? 'Your PDF thumbnail is ready.'
              : 'Your image preview is ready.'
            : waiting || preparing
              ? pdf
                ? 'Generating a first-page thumbnail. Your original is available now.'
                : 'Preparing a smaller preview. Your original is available now.'
              : data.processingError ||
                'The original is available. Retry to generate its thumbnail.'}
        </p>
        {!ready && !preparing && (
          <button
            type="button"
            className="details-retry"
            disabled={retrying}
            onClick={() => void retry()}
          >
            <RefreshCw
              size={13}
              className={retrying ? 'vault-spinner' : undefined}
            />
            {retrying ? 'Retrying...' : 'Retry preparation'}
          </button>
        )}
      </section>
      {retryError && (
        <p className="notice error" role="alert">
          {retryError}
        </p>
      )}
      <div className="dialog-actions details-actions">
        <a className="btn" href={`/api/files/${file.id}/download`}>
          <Download size={15} />
          Download
        </a>
        {pdf && (
          <Link className="btn" href={`/documents/${file.id}`}>
            <ArrowUpRight size={15} />
            Open PDF
          </Link>
        )}
        <button className="btn primary" onClick={() => onShare(file)}>
          <Link2 size={15} />
          Share
        </button>
      </div>
    </div>
  );
}
