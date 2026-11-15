/* eslint-disable @next/next/no-img-element -- Private authenticated originals. */
'use client';
import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize, Minimize } from 'lucide-react';
export function ImagePreview({ url, name }: { url: string; name: string }) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setBounds({ width: box.width, height: box.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setFull(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const fit =
    natural.width && natural.height && bounds.width && bounds.height
      ? Math.max(
          0.001,
          Math.min(
            (bounds.width - 2) / natural.width,
            (bounds.height - 2) / natural.height,
          ),
        )
      : 1;
  const scale = zoom ?? fit;
  const width = Math.max(1, Math.floor(natural.width * scale));
  const height = Math.max(1, Math.floor(natural.height * scale));
  async function fullView() {
    setZoom(null);
    try {
      if (document.fullscreenElement === root.current)
        await document.exitFullscreen();
      else if (root.current?.requestFullscreen)
        await root.current.requestFullscreen();
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError(
        'Full screen is unavailable. Use Open original to view the complete image.',
      );
    }
  }
  return (
    <div ref={root} className="image-viewer">
      <div className="preview-tools">
        <button
          type="button"
          className="icon-btn"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() =>
            setZoom(Math.max(Math.min(0.01, fit / 4), scale / 1.25))
          }
        >
          <ZoomOut size={18} />
        </button>
        <button
          type="button"
          className="image-zoom-value"
          title="View at actual size"
          aria-label="View at actual size"
          onClick={() => setZoom(1)}
        >
          {natural.width
            ? new Intl.NumberFormat(undefined, {
                maximumFractionDigits: 1,
              }).format(scale * 100) + '%'
            : 'Loading'}
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => setZoom(Math.min(Math.max(8, fit * 4), scale * 1.25))}
        >
          <ZoomIn size={18} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Fit image to view"
          title="Fit image to view"
          onClick={() => setZoom(null)}
        >
          <RotateCcw size={17} />
        </button>
        <button
          type="button"
          className="btn image-full-button"
          onClick={() => void fullView()}
        >
          {full ? <Minimize size={16} /> : <Maximize size={16} />}{' '}
          {full ? 'Exit full view' : 'View full'}
        </button>
      </div>
      <div ref={stage} className="image-view-stage">
        <div
          className="image-view-canvas"
          style={{
            width: Math.max(bounds.width, width),
            height: Math.max(bounds.height, height),
          }}
        >
          <img
            src={url}
            alt={name}
            onLoad={(event) =>
              setNatural({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            onError={() => setError('Image preview could not load.')}
            style={
              natural.width
                ? { width, height, maxWidth: 'none', maxHeight: 'none' }
                : { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }
            }
          />
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}{' '}
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open original
          </a>
        </p>
      )}
    </div>
  );
}
