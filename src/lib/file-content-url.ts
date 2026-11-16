export function thumbnailUrl(file: {
  id: string;
  thumbnailVersion?: number;
  processingStatus?: string;
}) {
  const version = `${file.thumbnailVersion ?? 0}-${file.processingStatus ?? 'ready'}`;
  return `/api/files/${file.id}/content?thumbnail=1&v=${encodeURIComponent(version)}`;
}
