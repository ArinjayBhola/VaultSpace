'use client';

import { Tooltip } from '@/components/ui/tooltip';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFPageProxy } from 'pdfjs-dist';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize,
  Download,
  Printer,
  Bookmark,
  Highlighter,
  StickyNote,
  Search,
  X,
  Trash2,
  Pencil,
  ArrowLeft,
} from 'lucide-react';
import { api } from '@/lib/client';
import { viewportRectangle } from '@/lib/pdf-geometry';
import { FileSharing } from '@/components/sharing/file-sharing';
import { Dialog } from '@/components/ui/dialog';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
const pdfOptions = {
  disableAutoFetch: true,
  disableStream: true,
  rangeChunkSize: 65536,
};
type Geometry = { x: number; y: number; width: number; height: number };
type Annotation = {
  id: string;
  pageNumber: number;
  annotationType: string;
  selectedText: string | null;
  geometryData: Geometry[] | null;
  color: string;
  note: string;
};
type PDFData = {
  file: {
    id: string;
    name: string;
    pageCount: number | null;
    processingStatus: string;
  };
  annotations: Annotation[];
  bookmarks: { id: string; pageNumber: number; label: string }[];
  progress: { pageNumber: number; zoomLevel: number } | null;
  matches: { pageNumber: number; text: string }[];
};
export default function Reader({ id }: { id: string }) {
  const client = useQueryClient();
  const params = useSearchParams();
  const { data, error } = useQuery({
    queryKey: ['pdf', id],
    queryFn: () => api<PDFData>(`/api/pdf/${id}`),
    refetchInterval: (query) =>
      ['pending', 'processing'].includes(
        query.state.data?.file.processingStatus ?? 'pending',
      )
        ? 3000
        : false,
  });
  const [page, setPage] = useState(Number(params.get('page')) || 1);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [pageProxy, setPageProxy] = useState<PDFPageProxy | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [color, setColor] = useState('#fde047');
  const [errorMessage, setErrorMessage] = useState('');
  const [note, setNote] = useState('');
  const [edit, setEdit] = useState<Annotation | null>(null);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [bookmarkEdit, setBookmarkEdit] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<{
    type: 'annotation' | 'bookmark';
    id: string;
  } | null>(null);
  const [thumbStart, setThumbStart] = useState(1);
  const [width, setWidth] = useState(650);
  const [areaHeight, setAreaHeight] = useState(800);
  const [fit, setFit] = useState<'width' | 'page' | null>(null);
  const pageEl = useRef<HTMLDivElement>(null);
  const readingArea = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const full = useRef<HTMLDivElement>(null);
  const { data: results } = useQuery({
    queryKey: ['pdf-search', id, search],
    queryFn: () =>
      api<PDFData>(`/api/pdf/${id}?q=${encodeURIComponent(search)}`),
    enabled: Boolean(search),
  });
  useEffect(() => {
    if (data && !initialized.current) {
      initialized.current = true;
      queueMicrotask(() => {
        if (!params.get('page')) setPage(data.progress?.pageNumber ?? 1);
        setZoom(data.progress?.zoomLevel ?? 100);
      });
    }
  }, [data, params]);
  useEffect(() => {
    if (!initialized.current || !loaded) return;
    const timeout = setTimeout(() => {
      void api(`/api/pdf/${id}`, {
        action: 'progress',
        pageNumber: page,
        zoomLevel: zoom,
      }).catch((e) =>
        setErrorMessage(
          e instanceof Error
            ? e.message
            : 'Reading position could not be saved.',
        ),
      );
    }, 600);
    return () => clearTimeout(timeout);
  }, [id, page, zoom, loaded]);
  useEffect(() => {
    const element = readingArea.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setWidth(Math.max(200, entry.contentRect.width - 50));
        setAreaHeight(entry.contentRect.height);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [data]);
  const navigate = useCallback(
    (next: number) => setPage(Math.max(1, Math.min(count || 1, next))),
    [count],
  );
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigate(page + 1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigate(page - 1);
      }
      if (e.key === 'Escape') document.getSelection()?.removeAllRanges();
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [page, navigate]);
  async function mutate(body: unknown) {
    setErrorMessage('');
    try {
      await api(`/api/pdf/${id}`, body);
      await client.invalidateQueries({ queryKey: ['pdf', id] });
      return true;
    } catch (e) {
      setErrorMessage(
        e instanceof Error ? e.message : 'Changes could not be saved.',
      );
      return false;
    }
  }
  async function highlight() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !pageEl.current || !pageProxy) {
      setErrorMessage(
        'Select text on the current page, then choose Highlight.',
      );
      return;
    }
    const range = selection.getRangeAt(0);
    if (!pageEl.current.contains(range.commonAncestorContainer)) {
      setErrorMessage('Select text inside the PDF page.');
      return;
    }
    const parent = pageEl.current.getBoundingClientRect();
    const viewport = pageProxy.getViewport({ scale: actualScale, rotation });
    const rectangles = Array.from(range.getClientRects())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => {
        const [a, b] = viewport.convertToPdfPoint(
          r.left - parent.left,
          r.top - parent.top,
        );
        const [c, d] = viewport.convertToPdfPoint(
          r.right - parent.left,
          r.bottom - parent.top,
        );
        return {
          x: Math.min(a, c),
          y: Math.min(b, d),
          width: Math.abs(c - a),
          height: Math.abs(d - b),
        };
      });
    if (!rectangles.length) return;
    const text = selection.toString();
    const saved = await mutate({
      action: 'annotate',
      pageNumber: page,
      annotationType: 'highlight',
      selectedText: text,
      anchorData: { text, page },
      geometryData: rectangles,
      color,
      note: '',
    });
    if (saved) selection.removeAllRanges();
  }
  let actualScale = zoom / 100;
  if (pageProxy && fit) {
    const viewport = pageProxy.getViewport({ scale: 1, rotation });
    actualScale =
      fit === 'width'
        ? width / viewport.width
        : Math.min(
            width / viewport.width,
            Math.max(250, areaHeight - 50) / viewport.height,
          );
  }
  const overlay = pageProxy
    ? pageProxy.getViewport({ scale: actualScale, rotation })
    : null;
  if (error) return <div className="notice error">{error.message}</div>;
  if (!data) return <div className="skeleton" style={{ height: 500 }} />;
  return (
    <div ref={full} style={{ background: 'var(--bg)', minHeight: '100%' }}>
      <div className="page-heading">
        <div>
          <Link
            href="/documents"
            className="link"
            style={{
              display: 'inline-flex',
              gap: 5,
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <ArrowLeft size={12} />
            Document library
          </Link>
          <h1
            style={{
              fontSize: 'max(9px, calc(23px * var(--vault-font-scale, 1)))',
              marginBottom: 5,
            }}
          >
            {data.file.name}
          </h1>
          <p>
            {data.file.processingStatus.replaceAll('_', ' ')} · Original file
            stays unchanged
          </p>
        </div>
        <a className="btn" href={`/api/files/${id}/content?download=1`}>
          <Download size={15} />
          Download
        </a>
      </div>
      {errorMessage && (
        <div className="notice error" role="alert">
          {errorMessage}
          <Tooltip label="Dismiss error">
            <button
              className="icon-btn"
              aria-label="Dismiss error"
              onClick={() => setErrorMessage('')}
            >
              <X size={14} />
            </button>
          </Tooltip>
        </div>
      )}
      {['ocr_required', 'limit_exceeded', 'failed'].includes(
        data.file.processingStatus,
      ) && (
        <div className="notice">
          {data.file.processingStatus === 'ocr_required'
            ? 'This document has no extractable text. OCR is required; visual reading and page notes are available.'
            : data.file.processingStatus === 'limit_exceeded'
              ? 'This PDF exceeds the preparation size limit. The original remains available.'
              : 'PDF preparation failed. Retry preparation from file details. The original remains available.'}
        </div>
      )}
      <div className="reader-toolbar card" style={{ padding: 9 }}>
        <Tooltip label="Previous page">
          <button
            className="icon-btn"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => navigate(page - 1)}
          >
            <ChevronLeft size={17} />
          </button>
        </Tooltip>
        <span className="reader-page-counter" aria-live="polite">
          Page {page} / {count || '...'}
        </span>
        <Tooltip label="Next page">
          <button
            className="icon-btn"
            aria-label="Next page"
            disabled={page >= count}
            onClick={() => navigate(page + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </Tooltip>
        <span style={{ height: 24, width: 1, background: 'var(--border)' }} />
        <Tooltip label="Zoom out">
          <button
            className="icon-btn"
            aria-label="Zoom out"
            disabled={zoom <= 25}
            onClick={() => {
              setFit(null);
              setZoom(Math.max(25, zoom - 25));
            }}
          >
            <ZoomOut size={17} />
          </button>
        </Tooltip>
        <span
          style={{
            fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
            width: 35,
            textAlign: 'center',
          }}
        >
          {Math.round(actualScale * 100)}%
        </span>
        <Tooltip label="Zoom in">
          <button
            className="icon-btn"
            aria-label="Zoom in"
            disabled={zoom >= 400}
            onClick={() => {
              setFit(null);
              setZoom(Math.min(400, zoom + 25));
            }}
          >
            <ZoomIn size={17} />
          </button>
        </Tooltip>
        <Select
          aria-label="Fit PDF page"
          value={fit ?? 'custom'}
          onChange={(e) =>
            setFit(
              e.target.value === 'width'
                ? 'width'
                : e.target.value === 'page'
                  ? 'page'
                  : null,
            )
          }
          style={{
            padding: '7px',
            fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
          }}
        >
          <option value="custom">Custom zoom</option>
          <option value="width">Fit width</option>
          <option value="page">Fit page</option>
        </Select>
        <Tooltip label="Rotate page">
          <button
            className="icon-btn"
            aria-label="Rotate page"
            onClick={() => setRotation((rotation + 90) % 360)}
          >
            <RotateCw size={17} />
          </button>
        </Tooltip>
        <Tooltip label="Full screen">
          <button
            className="icon-btn"
            aria-label="Full screen"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else
                void full.current
                  ?.requestFullscreen()
                  .catch(() =>
                    setErrorMessage(
                      'Full screen is not supported by this browser.',
                    ),
                  );
            }}
          >
            <Maximize size={17} />
          </button>
        </Tooltip>
        <Tooltip label="Open original for browser printing">
          <a
            className="icon-btn"
            aria-label="Open original for browser printing"
            href={`/api/files/${id}/content`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Printer size={17} />
          </a>
        </Tooltip>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <Select
            aria-label="Highlight color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{
              padding: 7,
              fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
            }}
          >
            <option value="#fde047">Yellow</option>
            <option value="#86efac">Green</option>
            <option value="#93c5fd">Blue</option>
            <option value="#f9a8d4">Pink</option>
          </Select>
          <button
            className="btn"
            style={{
              padding: '8px 10px',
              fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void highlight()}
          >
            <Highlighter size={15} />
            Highlight selection
          </button>
        </div>
      </div>
      <FileSharing fileId={id} name={data.file.name} />
      <Document
        options={pdfOptions}
        file={`/api/files/${id}/content`}
        onLoadSuccess={(document) => {
          setCount(document.numPages);
          setLoaded(true);
          if (page > document.numPages) setPage(document.numPages);
        }}
        onLoadError={(e) => setErrorMessage(`Cannot open PDF: ${e.message}`)}
        loading={<div className="empty">Opening your document…</div>}
        error={
          <div className="notice error">
            PDF could not be rendered. Try downloading the original or check
            whether it is encrypted.
          </div>
        }
      >
        <div className="reader">
          <aside
            className="card reader-side reader-thumbs"
            aria-label="Page thumbnails"
          >
            <h2
              style={{
                fontSize: 'max(9px, calc(14.5px * var(--vault-font-scale, 1)))',
              }}
            >
              Pages
            </h2>
            {Array.from(
              { length: Math.min(8, Math.max(0, count - thumbStart + 1)) },
              (_, i) => thumbStart + i,
            ).map((n) => (
              <Tooltip key={n} label={`Go to page ${n}`}>
                <button
                  key={n}
                  style={{
                    display: 'block',
                    border:
                      n === page
                        ? '2px solid #2563eb'
                        : '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'white',
                    padding: 5,
                    marginBottom: 13,
                    width: '100%',
                    overflow: 'hidden',
                  }}
                  aria-label={`Go to page ${n}`}
                  onClick={() => navigate(n)}
                >
                  <Page
                    pageNumber={n}
                    width={125}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                  <span
                    style={{
                      fontSize:
                        'max(9px, calc(12px * var(--vault-font-scale, 1)))',
                      color: '#64748b',
                      display: 'block',
                      paddingTop: 5,
                    }}
                  >
                    {n}
                  </span>
                </button>
              </Tooltip>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Tooltip label="Previous thumbnails">
                <button
                  className="icon-btn"
                  aria-label="Previous thumbnails"
                  disabled={thumbStart <= 1}
                  onClick={() => setThumbStart(Math.max(1, thumbStart - 8))}
                >
                  <ChevronLeft size={15} />
                </button>
              </Tooltip>
              <Tooltip label="Next thumbnails">
                <button
                  className="icon-btn"
                  aria-label="Next thumbnails"
                  disabled={thumbStart + 8 > count}
                  onClick={() => setThumbStart(thumbStart + 8)}
                >
                  <ChevronRight size={15} />
                </button>
              </Tooltip>
            </div>
          </aside>
          <div ref={readingArea} className="reader-main">
            <div ref={pageEl} className="pdf-page">
              <Page
                key={page}
                pageNumber={page}
                scale={actualScale}
                rotate={rotation}
                onLoadSuccess={setPageProxy}
                renderTextLayer
                renderAnnotationLayer={false}
              />
              {overlay &&
                data.annotations
                  .filter((a) => a.pageNumber === page)
                  .flatMap((a) =>
                    (a.geometryData ?? []).map((g, i) => {
                      const rectangle = viewportRectangle(overlay.transform, g);
                      return (
                        <span
                          key={`${a.id}-${i}`}
                          className="highlight"
                          style={{
                            left: Math.min(rectangle[0], rectangle[2]),
                            top: Math.min(rectangle[1], rectangle[3]),
                            width: Math.abs(rectangle[2] - rectangle[0]),
                            height: Math.abs(rectangle[3] - rectangle[1]),
                            background: a.color,
                          }}
                        />
                      );
                    }),
                  )}
            </div>
          </div>
          <aside className="card reader-side" aria-label="Document annotations">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(query);
              }}
            >
              <label className="form-field" style={{ marginTop: 0 }}>
                Search in document
                <div style={{ display: 'flex', gap: 5 }}>
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Find text…"
                    style={{ width: '100%', minWidth: 0 }}
                  />
                  <Tooltip label="Search PDF">
                    <button className="icon-btn" aria-label="Search PDF">
                      <Search size={16} />
                    </button>
                  </Tooltip>
                </div>
              </label>
            </form>
            {search && (
              <section style={{ marginBottom: 20 }}>
                <h2
                  style={{
                    fontSize:
                      'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
                  }}
                >
                  Search results · {results?.matches.length ?? '…'} pages
                </h2>
                {results?.matches.length === 0 && (
                  <p
                    className="muted"
                    style={{
                      fontSize:
                        'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                    }}
                  >
                    No matches in extracted text. Processing may still be
                    pending.
                  </p>
                )}
                {results?.matches.map((m) => (
                  <button
                    key={m.pageNumber}
                    className="reader-note"
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: 'var(--bg)',
                    }}
                    onClick={() => navigate(m.pageNumber)}
                  >
                    <strong>Page {m.pageNumber}</strong>
                    <p
                      style={{
                        fontSize:
                          'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                        lineHeight: 1.6,
                        margin: '5px 0 0',
                      }}
                    >
                      {m.text}
                    </p>
                  </button>
                ))}
              </section>
            )}
            <h2
              style={{
                fontSize: 'max(9px, calc(14.5px * var(--vault-font-scale, 1)))',
                marginTop: 23,
                display: 'flex',
                gap: 7,
              }}
            >
              <Bookmark size={15} />
              Bookmarks
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void mutate({
                  action: 'bookmark',
                  pageNumber: page,
                  label: bookmarkLabel || `Page ${page}`,
                }).then((saved) => {
                  if (saved) setBookmarkLabel('');
                });
              }}
              style={{ display: 'flex', gap: 5 }}
            >
              <Input
                aria-label="Bookmark label"
                placeholder={`Page ${page}`}
                value={bookmarkLabel}
                onChange={(e) => setBookmarkLabel(e.target.value)}
                style={{
                  width: '100%',
                  minWidth: 0,
                  fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                }}
              />
              <Tooltip label="Bookmark current page">
                <button className="icon-btn" aria-label="Bookmark current page">
                  <Bookmark size={16} />
                </button>
              </Tooltip>
            </form>
            {data.bookmarks.map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                  marginTop: 7,
                }}
              >
                <button
                  className="tab"
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  onClick={() => navigate(b.pageNumber)}
                >
                  {b.label} · p.{b.pageNumber}
                </button>
                <Tooltip label={`Rename bookmark ${b.label}`}>
                  <button
                    className="icon-btn"
                    aria-label={`Rename bookmark ${b.label}`}
                    onClick={() =>
                      setBookmarkEdit({ id: b.id, label: b.label })
                    }
                  >
                    <Pencil size={12} />
                  </button>
                </Tooltip>
                <Tooltip label={`Delete bookmark ${b.label}`}>
                  <button
                    className="icon-btn danger"
                    aria-label={`Delete bookmark ${b.label}`}
                    onClick={() => setDeleting({ type: 'bookmark', id: b.id })}
                  >
                    <X size={12} />
                  </button>
                </Tooltip>
              </div>
            ))}
            <h2
              style={{
                fontSize: 'max(9px, calc(14.5px * var(--vault-font-scale, 1)))',
                marginTop: 25,
                display: 'flex',
                gap: 7,
              }}
            >
              <StickyNote size={15} />
              Notes & highlights
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void mutate({
                  action: 'annotate',
                  pageNumber: page,
                  annotationType: 'note',
                  selectedText: null,
                  anchorData: null,
                  geometryData: null,
                  color,
                  note,
                }).then((saved) => {
                  if (saved) setNote('');
                });
              }}
            >
              <label className="visually-hidden" htmlFor="page-note">
                Page note
              </label>
              <Textarea
                id="page-note"
                rows={3}
                required
                placeholder={`Add a note on page ${page}…`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{
                  width: '100%',
                  fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                }}
              />
              <button
                className="btn"
                style={{
                  width: '100%',
                  fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                  marginTop: 7,
                }}
              >
                Save page note
              </button>
            </form>
            {data.annotations.map((a) => (
              <div key={a.id} className="reader-note">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <button
                    className="tab"
                    style={{
                      padding: 0,
                      fontSize:
                        'max(9px, calc(12px * var(--vault-font-scale, 1)))',
                      color: 'var(--blue)',
                    }}
                    onClick={() => navigate(a.pageNumber)}
                  >
                    Page {a.pageNumber}
                  </button>
                  <div>
                    <Tooltip label="Edit annotation">
                      <button
                        className="icon-btn"
                        style={{ width: 24, height: 24 }}
                        aria-label="Edit annotation"
                        onClick={() => setEdit(a)}
                      >
                        <Pencil size={12} />
                      </button>
                    </Tooltip>
                    <Tooltip label="Delete annotation">
                      <button
                        className="icon-btn danger"
                        style={{ width: 24, height: 24 }}
                        aria-label="Delete annotation"
                        onClick={() =>
                          setDeleting({ type: 'annotation', id: a.id })
                        }
                      >
                        <Trash2 size={12} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
                {a.selectedText && (
                  <blockquote
                    style={{
                      margin: '7px 0',
                      paddingLeft: 8,
                      borderLeft: `3px solid ${a.color}`,
                      fontSize:
                        'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                      lineHeight: 1.7,
                    }}
                  >
                    {a.selectedText}
                  </blockquote>
                )}
                {a.note && (
                  <p
                    style={{
                      fontSize:
                        'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      marginBottom: 0,
                    }}
                  >
                    {a.note}
                  </p>
                )}
              </div>
            ))}
          </aside>
        </div>
      </Document>
      <Dialog
        open={Boolean(edit)}
        onOpenChange={(open) => {
          if (!open) setEdit(null);
        }}
        title="Edit annotation"
        description="Add a note or update the highlight color."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (edit)
              void mutate({
                action: 'annotation-update',
                id: edit.id,
                note: edit.note,
                color: edit.color,
              }).then((saved) => {
                if (saved) setEdit(null);
              });
          }}
        >
          <label className="form-field">
            Note
            <Textarea
              placeholder="Write a note about this page or selection"
              rows={5}
              value={edit?.note ?? ''}
              onChange={(e) =>
                setEdit((prev) =>
                  prev ? { ...prev, note: e.target.value } : prev,
                )
              }
            />
          </label>
          <label className="form-field">
            Color
            <Select
              value={edit?.color ?? '#fde047'}
              onChange={(e) =>
                setEdit((prev) =>
                  prev ? { ...prev, color: e.target.value } : prev,
                )
              }
            >
              {[
                ['#fde047', 'Yellow'],
                ['#86efac', 'Green'],
                ['#93c5fd', 'Blue'],
                ['#f9a8d4', 'Pink'],
              ].map(([c, l]) => (
                <option key={c} value={c}>
                  {l}
                </option>
              ))}
            </Select>
          </label>
          <div className="dialog-actions">
            <button className="btn primary">Save annotation</button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={Boolean(bookmarkEdit)}
        onOpenChange={(open) => {
          if (!open) setBookmarkEdit(null);
        }}
        title="Rename bookmark"
        description="Give this page a useful label."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (bookmarkEdit)
              void mutate({ action: 'bookmark-update', ...bookmarkEdit }).then(
                (saved) => {
                  if (saved) setBookmarkEdit(null);
                },
              );
          }}
        >
          <label className="form-field">
            Label
            <Input
              placeholder="e.g. Important section"
              required
              value={bookmarkEdit?.label ?? ''}
              onChange={(e) =>
                setBookmarkEdit((prev) =>
                  prev ? { ...prev, label: e.target.value } : prev,
                )
              }
            />
          </label>
          <button className="btn primary">Save bookmark</button>
        </form>
      </Dialog>
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this item?"
        description="This annotation or bookmark will be permanently removed."
      >
        <div className="dialog-actions">
          <button className="btn" onClick={() => setDeleting(null)}>
            Cancel
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (deleting)
                void mutate({
                  action: `${deleting.type}-delete`,
                  id: deleting.id,
                }).then((saved) => {
                  if (saved) setDeleting(null);
                });
            }}
          >
            Delete
          </button>
        </div>
      </Dialog>
    </div>
  );
}
