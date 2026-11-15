import { FolderLockedError } from '@/lib/folder-access';
import { notFound, redirect } from 'next/navigation';
import { pageOwner } from '@/lib/auth';
import { id } from '@/lib/validation';
import { ownedFile } from '@/features/files/service';
import { FileWorkspace } from '@/components/files/file-workspace';
export default async function FilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const parsed = id.safeParse((await params).id);
  if (!parsed.success) notFound();
  const user = await pageOwner();
  const file = await ownedFile(user.id, parsed.data).catch((error) => {
    if (error instanceof FolderLockedError)
      redirect('/folders/' + error.folderId);
    throw error;
  });
  if (file.mimeType === 'application/pdf') redirect('/documents/' + file.id);
  return <FileWorkspace id={file.id} />;
}
