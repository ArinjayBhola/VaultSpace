export function fileQuery(pathname: string, search: URLSearchParams) {
  const query = new URLSearchParams(search);
  const folder = pathname.startsWith('/folders/')
    ? pathname.split('/')[2]
    : null;
  const collection = pathname.startsWith('/collections/')
    ? pathname.split('/')[2]
    : null;
  const view =
    pathname === '/'
      ? 'recent'
      : pathname === '/trash'
        ? 'trash'
        : pathname === '/starred'
          ? 'starred'
          : pathname === '/documents'
            ? 'documents'
            : pathname === '/recent'
              ? 'recent'
              : pathname === '/files' || folder
                ? 'root'
                : 'all';
  query.set('view', view);
  query.set('limit', pathname === '/' ? '8' : '24');
  if (folder) query.set('folder', folder);
  if (collection) query.set('collection', collection);
  const types = Array.from(
    new Set(query.getAll('type').filter((value) => value && value !== 'all')),
  ).sort();
  query.delete('type');
  for (const type of types) query.append('type', type);
  return query.toString();
}
