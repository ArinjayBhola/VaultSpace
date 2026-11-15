export async function api<T>(
  url: string,
  body?: unknown,
  method = 'POST',
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(
    url,
    body === undefined
      ? { cache: 'no-store', signal }
      : {
          method,
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `The service returned an unreadable response (${response.status}). Please retry.`,
    );
  }
  if (!response.ok)
    throw new Error(
      typeof data?.error?.message === 'string'
        ? data.error.message
        : typeof data?.message === 'string'
          ? data.message
          : 'The request failed. Please retry.',
    );
  return data;
}
export function bytes(value: number) {
  if (value === 0) return '0 B';
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 4);
  return `${(value / 1024 ** i).toFixed(i ? 1 : 0)} ${['B', 'KB', 'MB', 'GB', 'TB'][i]}`;
}
// A deterministic default is required for server rendering and hydration.
// Client UI supplies browser preferences only after hydration.
export function date(
  value: string | Date | null,
  locale = 'en-US',
  timeZone = 'Asia/Kolkata',
) {
  if (!value) return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(parsed);
}
