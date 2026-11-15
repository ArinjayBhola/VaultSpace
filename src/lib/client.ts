import { z } from 'zod';

const errorResponse = z.object({
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
      folder: z.object({ id: z.uuid(), name: z.string().max(240) }).optional(),
    })
    .optional(),
  message: z.string().optional(),
});
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public folder?: { id: string; name: string },
  ) {
    super(message);
  }
}
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
  if (!response.ok) {
    const parsed = errorResponse.safeParse(data);
    const detail = parsed.success ? parsed.data : undefined;
    throw new ApiClientError(
      detail?.error?.message ??
        detail?.message ??
        'The request failed. Please retry.',
      response.status,
      detail?.error?.code,
      detail?.error?.folder,
    );
  }
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
