import { z } from 'zod';
export const id = z.uuid();
export const name = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine(
    (v) => !/[\x00-\x1f/\\]/.test(v),
    'Names cannot contain path separators or control characters.',
  );
export function validFile(
  filename: string,
  mime: string,
  size: number,
  limit: number,
) {
  return (
    name.safeParse(filename).success &&
    size > 0 &&
    size <= limit &&
    /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(mime)
  );
}
export const searchFilters = z.object({
  collectionPage: z.coerce.number().int().min(1).max(100000).default(1),
  collectionQuery: z.string().max(200).default(''),
  folderPage: z.coerce.number().int().min(1).max(100000).default(1),
  q: z.string().max(500).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  sort: z
    .enum(['relevance', 'name', 'created', 'modified', 'size', 'type'])
    .default('relevance'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  view: z
    .enum(['all', 'root', 'recent', 'starred', 'documents', 'trash'])
    .default('all'),
  type: z
    .preprocess(
      (value) => (typeof value === 'string' ? [value] : value),
      z.array(z.string().min(1).max(160)).max(100).default([]),
    )
    .transform((values) =>
      Array.from(new Set(values.filter((value) => value !== 'all'))),
    ),
  folder: id.optional(),
  collection: id.optional(),
  minSize: z.coerce.number().nonnegative().optional(),
  maxSize: z.coerce.number().nonnegative().optional(),
  after: z.iso.datetime().optional(),
  before: z.iso.datetime().optional(),
  status: z.string().max(40).optional(),
  starred: z.enum(['true', 'false']).optional(),
});
export function wouldCycle(
  node: string,
  parent: string | null,
  descendants: string[],
) {
  return parent !== null && (parent === node || descendants.includes(parent));
}
export function shareValid(
  expires: Date | null,
  revoked: Date | null,
  now = new Date(),
) {
  return !revoked && (!expires || expires > now);
}
export const uploadTransitions: Record<string, readonly string[]> = {
  pending: ['verifying', 'cancelled'],
  verifying: ['complete', 'pending'],
  complete: [],
  cancelled: [],
};
export function canTransition(from: string, to: string) {
  return uploadTransitions[from]?.includes(to) ?? false;
}
