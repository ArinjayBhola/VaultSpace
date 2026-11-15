import { FolderLockedError } from '@/lib/folder-access';
import { pageOwner } from '@/lib/auth';
import { ownedFile } from '@/features/files/service';
import { PDFWorkspace } from '@/components/pdf/workspace';
import { id } from '@/lib/validation';
import { notFound, redirect } from 'next/navigation';
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = id.safeParse((await params).id);
  if (!result.success) notFound();
  const user = await pageOwner();
  await ownedFile(user.id, result.data).catch((error) => {
    if (error instanceof FolderLockedError)
      redirect('/folders/' + error.folderId);
    throw error;
  });
  return <PDFWorkspace id={result.data} />;
}
