import {
  QueryClient,
  HydrationBoundary,
  dehydrate,
} from '@tanstack/react-query';
import { pageOwner } from '@/lib/auth';
import { fileQuery } from '@/lib/file-query';
import { searchFilters } from '@/lib/validation';
import { workspaceData } from '@/features/files/workspace-query';
import { notFound } from 'next/navigation';
import { Workspace } from '@/components/files/workspace';
import { QUERY_STALE_TIME } from '@/lib/cache-policy';
export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  const pathname = '/' + path.join('/');
  if (['/settings', '/shared', '/analytics', '/activity'].includes(pathname))
    return <Workspace key={path.join('/')} />;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value))
      for (const item of value) search.append(key, item);
    else if (value !== undefined) search.set(key, value);
  }
  const key = fileQuery(pathname, search);
  const query = searchFilters.safeParse({
    ...Object.fromEntries(new URLSearchParams(key)),
    type: new URLSearchParams(key).getAll('type'),
  });
  if (!query.success) notFound();
  const user = await pageOwner();
  const client = new QueryClient();
  await client.fetchQuery({
    queryKey: ['files', key],
    queryFn: () => workspaceData(user.id, query.data),
    staleTime: QUERY_STALE_TIME,
  });
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <Workspace key={path.join('/')} />
    </HydrationBoundary>
  );
}
