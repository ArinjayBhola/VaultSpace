import { PDFWorkspace } from '@/components/pdf/workspace';
import { id } from '@/lib/validation';
import { notFound } from 'next/navigation';
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = id.safeParse((await params).id);
  if (!result.success) notFound();
  return <PDFWorkspace id={result.data} />;
}
