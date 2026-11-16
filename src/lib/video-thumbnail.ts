'use client';

import type { QueryClient } from '@tanstack/react-query';
import { isGalleryVideo } from './file-types';

type VideoFile = {
  id: string;
  originalFilename: string;
  mimeType: string;
  hasThumbnail?: boolean;
  thumbnailVersion?: number;
};
let queue = Promise.resolve();
const attempts = new Map<
  string,
  { time: number; settled: boolean; result: Promise<boolean> }
>();
const refreshTimers = new WeakMap<QueryClient, ReturnType<typeof setTimeout>>();

export function refreshVideoThumbnails(client: QueryClient) {
  const timer = refreshTimers.get(client);
  if (timer) clearTimeout(timer);
  refreshTimers.set(
    client,
    setTimeout(() => {
      refreshTimers.delete(client);
      void Promise.all(
        ['files', 'file-details', 'analytics'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    }, 1500),
  );
}

export async function captureVideoFrame(source: string | File) {
  const video = document.createElement('video');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const objectUrl =
    typeof source === 'string' ? null : URL.createObjectURL(source);
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  function waitFor(event: string) {
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        video.removeEventListener(event, done);
        video.removeEventListener('error', failed);
        controller.signal.removeEventListener('abort', failed);
      };
      const done = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error('Video frame could not be decoded.'));
      };
      if (controller.signal.aborted || video.error) {
        failed();
        return;
      }
      video.addEventListener(event, done, { once: true });
      video.addEventListener('error', failed, { once: true });
      controller.signal.addEventListener('abort', failed, { once: true });
    });
  }
  try {
    const metadata = waitFor('loadedmetadata');
    video.src = objectUrl ?? (source as string);
    video.load();
    await metadata;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height || width > 32768 || height > 32768)
      throw new Error('Video dimensions are unavailable.');
    const position =
      Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(1, video.duration * 0.1)
        : 0;
    if (position > 0) {
      const seek = waitFor('seeked');
      video.currentTime = position;
      await seek;
    }
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
      await waitFor('loadeddata');
    const scale = Math.min(1, 640 / width, 480 / height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Video frame canvas is unavailable.');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error('Video frame could not be encoded.')),
        'image/jpeg',
        0.8,
      ),
    );
    if (controller.signal.aborted)
      throw new Error('Video thumbnail preparation timed out.');
    return { blob, width, height };
  } finally {
    clearTimeout(timeout);
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function ensureVideoThumbnail(
  file: VideoFile,
  source?: File,
): Promise<boolean> {
  if (
    file.hasThumbnail ||
    !isGalleryVideo(file.originalFilename, file.mimeType)
  )
    return Promise.resolve(false);
  const key = `${file.id}:${file.thumbnailVersion ?? 0}`;
  const now = Date.now();
  const existing = attempts.get(key);
  if (existing && (!existing.settled || now - existing.time < 5 * 60 * 1000))
    return existing.result;
  for (const [id, attempt] of attempts)
    if (attempt.settled && now - attempt.time >= 5 * 60 * 1000)
      attempts.delete(id);
  const result = queue.then(async () => {
    try {
      const frame = await captureVideoFrame(
        source ?? `/api/files/${file.id}/content?media=1`,
      );
      const params = new URLSearchParams({
        width: String(frame.width),
        height: String(frame.height),
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch(
          `/api/files/${file.id}/thumbnail?${params}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg' },
            body: frame.blob,
            signal: controller.signal,
          },
        );
        if (response.status === 401 || response.status === 423)
          attempts.delete(key);
        return response.ok;
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Keep the original usable and the generic video tile for unsupported codecs.
      return false;
    }
  });
  const attempt = { time: now, settled: false, result };
  queue = result.then(() => {
    attempt.time = Date.now();
    attempt.settled = true;
  });
  attempts.set(key, attempt);
  return result;
}
