/* eslint-disable @next/next/no-img-element -- Originals require the owner's authenticated request. */
'use client';

import { useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, LoaderCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import './image-lightbox.css';

export function ImageLightbox({
  url,
  name,
  onClose,
}: {
  url: string;
  name: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={name}
      description="Image preview. Use the controls to zoom in, zoom out, or fit the image."
      className="image-lightbox-dialog"
    >
      <LightboxImage key={url} url={url} name={name} />
    </Dialog>
  );
}

function LightboxImage({ url, name }: { url: string; name: string }) {
  const [viewport, setViewport] = useState({ width: 320, height: 240 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const update = () =>
      setViewport({
        width: Math.max(1, window.innerWidth - 40),
        height: Math.max(1, window.innerHeight - 110),
      });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const loaded = natural.width > 0;
  const fit = loaded
    ? Math.min(viewport.width / natural.width, viewport.height / natural.height)
    : 1;
  const scale = zoom ?? fit;
  const width = loaded
    ? Math.max(1, Math.round(natural.width * scale))
    : Math.min(320, viewport.width);
  const height = loaded
    ? Math.max(1, Math.round(natural.height * scale))
    : Math.min(240, viewport.height);
  return (
    <>
      <div
        className="lightbox-image-stage"
        style={{
          width: Math.min(width, viewport.width),
          height: Math.min(height, viewport.height),
        }}
      >
        {!loaded && !error && (
          <span className="lightbox-loading" role="status">
            <LoaderCircle size={24} className="vault-spinner" />
            <span className="visually-hidden">Loading image</span>
          </span>
        )}
        <div className="lightbox-image-canvas" style={{ width, height }}>
          <img
            src={url}
            alt={name}
            onLoad={(event) =>
              setNatural({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            onError={() => setError(true)}
            style={{ width, height, visibility: loaded ? 'visible' : 'hidden' }}
          />
        </div>
        {error && (
          <p className="lightbox-image-error" role="alert">
            Image could not load.{' '}
            <a href={url} target="_blank" rel="noopener noreferrer">
              Open original
            </a>
          </p>
        )}
      </div>
      <div
        className="lightbox-zoom-controls"
        role="group"
        aria-label="Image zoom"
      >
        <button
          type="button"
          className="icon-btn"
          disabled={!loaded}
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() =>
            setZoom(Math.max(Math.min(0.01, fit / 4), scale / 1.25))
          }
        >
          <ZoomOut size={18} />
        </button>
        <span className="lightbox-zoom-value" aria-live="polite">
          {loaded
            ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(scale * 100)}%`
            : '—'}
        </span>
        <button
          type="button"
          className="icon-btn"
          disabled={!loaded}
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => setZoom(Math.min(Math.max(8, fit * 4), scale * 1.25))}
        >
          <ZoomIn size={18} />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={!loaded}
          aria-label="Fit image to view"
          title="Fit image to view"
          onClick={() => setZoom(null)}
        >
          <RotateCcw size={17} />
        </button>
      </div>
    </>
  );
}
