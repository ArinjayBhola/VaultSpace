import { notFound } from 'next/navigation';
import { Workspace } from '@/components/files/workspace';
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const path = (await params).path ?? [];
  const valid = [
    'files',
    'collections',
    'recent',
    'starred',
    'search',
    'documents',
    'trash',
    'shared',
    'analytics',
    'activity',
    'settings',
  ];
  if (
    path.length > 2 ||
    (path.length === 1 && !valid.includes(path[0])) ||
    (path.length === 2 && !['folders', 'collections'].includes(path[0]))
  )
    notFound();
  return <Workspace key={path.join('/')} />;
}
