export const rasterTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];
export const galleryImageExtensions = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'avif',
];
export function needsThumbnail(mime: string) {
  return mime === 'application/pdf' || rasterTypes.includes(mime);
}
export function safeInline(mime: string) {
  return (
    needsThumbnail(mime) ||
    [
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/flac',
      'audio/mp4',
      'video/mp4',
      'video/webm',
      'video/ogg',
    ].includes(mime)
  );
}
export function extensionOf(name: string) {
  const position = name.lastIndexOf('.');
  return position > 0 ? name.slice(position + 1).toLowerCase() : '';
}
const mimeByExtension: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  ts: 'text/plain',
  yaml: 'text/plain',
  yml: 'text/plain',
  log: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
};
export function uploadMime(name: string, browserMime: string) {
  return (
    mimeByExtension[extensionOf(name)] ||
    (/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(browserMime)
      ? browserMime
      : 'application/octet-stream')
  );
}
export function extensionForMime(mime: string) {
  return (
    Object.entries(mimeByExtension).find(([, value]) => value === mime)?.[0] ??
    ''
  );
}
// Keep preview availability and rendering on the same capability map.
export function filePreviewKind(name: string, mime: string) {
  const extension = extensionForMime(mime) || extensionOf(name);
  if (rasterTypes.includes(mime)) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (
    (mime.startsWith('audio/') || mime.startsWith('video/')) &&
    safeInline(mime)
  )
    return 'media';
  if (['docx', 'xlsx', 'pptx'].includes(extension)) return 'office';
  if (
    mime.startsWith('text/') ||
    [
      'json',
      'xml',
      'csv',
      'md',
      'yaml',
      'yml',
      'log',
      'html',
      'svg',
      'js',
      'ts',
      'tsx',
      'jsx',
      'py',
      'sql',
      'css',
      'sh',
      'ini',
      'toml',
    ].includes(extension)
  )
    return 'text';
  return null;
}
export function canPreviewFile(name: string, mime: string, size: number) {
  const kind = filePreviewKind(name, mime);
  return kind !== null && (kind !== 'office' || size <= 20 * 1024 * 1024);
}
export function typeLabel(extension: string, mime: string) {
  return extension
    ? extension.toUpperCase()
    : mime === 'application/octet-stream'
      ? 'Other files'
      : extensionForMime(mime).toUpperCase() || mime;
}
