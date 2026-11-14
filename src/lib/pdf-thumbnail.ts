import type { PDFPageProxy } from 'pdfjs-dist';
// PDF.js supports native Node canvases, but its browser declaration accepts only
// HTMLCanvasElement. Validate its public render-task contract at this boundary.
export async function pdfThumbnail(page: PDFPageProxy) {
  const { createCanvas } = await import('@napi-rs/canvas');
  const original = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: Math.min(1, 640 / original.width, 960 / original.height),
  });
  const canvas = createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  const result: unknown = Reflect.apply(page.render, page, [
    { canvas, viewport },
  ]);
  if (
    typeof result !== 'object' ||
    result === null ||
    !('promise' in result) ||
    !(result.promise instanceof Promise)
  )
    throw new Error('PDF renderer returned an invalid task.');
  await result.promise;
  return canvas.encode('webp', 78);
}
