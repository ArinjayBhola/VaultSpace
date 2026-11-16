/* eslint-disable @next/next/no-img-element -- Originals require the owner's authenticated request. */
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  LoaderCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import './image-lightbox.css';

type ImageProps = {
  url: string;
  name: string;
  onClose: () => void;
};
type Navigation = {
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  busy: boolean;
  error: string;
};

export function ImageLightbox(props: ImageProps) {
  return <MediaLightbox {...props} />;
}

export function MediaLightbox({
  url,
  name,
  onClose,
  video = false,
  mimeType = '',
  downloadUrl = url,
  navigation,
}: ImageProps & {
  video?: boolean;
  mimeType?: string;
  downloadUrl?: string;
  navigation?: Navigation;
}) {
  useEffect(() => {
    if (!navigation) return;
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.repeat ||
        document.fullscreenElement
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest('input,textarea,select,[role="slider"]') ||
          target.isContentEditable)
      )
        return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      event.stopPropagation();
      if (navigation.busy) return;
      if (event.key === 'ArrowLeft' && navigation.hasPrevious)
        navigation.onPrevious();
      if (event.key === 'ArrowRight' && navigation.hasNext) navigation.onNext();
    };
    window.addEventListener('keydown', keyboard, true);
    return () => window.removeEventListener('keydown', keyboard, true);
  }, [navigation]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={name}
      description={
        video
          ? 'Video preview. Use the player controls for playback.'
          : 'Image preview. Use the controls to zoom in, zoom out, or fit the image.'
      }
      className="image-lightbox-dialog"
    >
      {video ? (
        <LightboxVideo
          key={url}
          url={url}
          name={name}
          mimeType={mimeType}
          downloadUrl={downloadUrl}
          withNavigation={Boolean(navigation)}
        />
      ) : (
        <LightboxImage
          key={url}
          url={url}
          name={name}
          withNavigation={Boolean(navigation)}
        />
      )}
      {navigation && (
        <>
          <button
            type="button"
            className="icon-btn lightbox-nav lightbox-previous"
            aria-label="Previous item"
            title="Previous item (Left arrow)"
            disabled={!navigation.hasPrevious || navigation.busy}
            onClick={navigation.onPrevious}
          >
            <ChevronLeft size={23} />
          </button>
          <button
            type="button"
            className="icon-btn lightbox-nav lightbox-next"
            aria-label="Next item"
            title="Next item (Right arrow)"
            disabled={!navigation.hasNext || navigation.busy}
            onClick={navigation.onNext}
          >
            {navigation.busy ? (
              <LoaderCircle size={20} className="vault-spinner" />
            ) : (
              <ChevronRight size={23} />
            )}
          </button>
          {navigation.error && (
            <p className="lightbox-navigation-error" role="alert">
              {navigation.error}
            </p>
          )}
        </>
      )}
    </Dialog>
  );
}

function useLightboxViewport(withNavigation: boolean) {
  const [viewport, setViewport] = useState({
    width: withNavigation ? 208 : 320,
    height: 240,
  });
  useEffect(() => {
    const update = () =>
      setViewport({
        // Leave room for 38px arrows, a 10px gap and the viewport edge on each side.
        width: Math.max(1, window.innerWidth - (withNavigation ? 112 : 40)),
        height: Math.max(1, window.innerHeight - 110),
      });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [withNavigation]);
  return viewport;
}

function LightboxVideo({
  url,
  name,
  mimeType,
  downloadUrl,
  withNavigation,
}: {
  url: string;
  name: string;
  mimeType: string;
  downloadUrl: string;
  withNavigation: boolean;
}) {
  const viewport = useLightboxViewport(withNavigation);
  const [natural, setNatural] = useState({ width: 16, height: 9 });
  const [failed, setFailed] = useState(false);
  const player = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = player.current;
    return () => {
      if (element) {
        element.pause();
        element.removeAttribute('src');
        element.load();
      }
    };
  }, []);
  const scale = Math.min(
    viewport.width / natural.width,
    viewport.height / natural.height,
  );
  const unsupported = failed || !mimeType.startsWith('video/');
  return (
    <div
      className="lightbox-video-stage"
      style={{
        width: Math.floor(natural.width * scale),
        height: unsupported
          ? Math.min(
              viewport.height,
              Math.max(220, Math.floor(natural.height * scale)),
            )
          : Math.floor(natural.height * scale),
      }}
    >
      {unsupported ? (
        <div className="lightbox-video-message">
          <Film size={32} />
          <p>This video cannot be played in this browser.</p>
          <a className="btn" href={downloadUrl}>
            <Download size={15} />
            Download video
          </a>
        </div>
      ) : (
        <video
          ref={player}
          src={url}
          controls
          playsInline
          preload="metadata"
          aria-label={name}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            if (video.videoWidth && video.videoHeight)
              setNatural({
                width: video.videoWidth,
                height: video.videoHeight,
              });
          }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function LightboxImage({
  url,
  name,
  withNavigation,
}: {
  url: string;
  name: string;
  withNavigation: boolean;
}) {
  const viewport = useLightboxViewport(withNavigation);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number | null>(null);
  const [error, setError] = useState(false);
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
