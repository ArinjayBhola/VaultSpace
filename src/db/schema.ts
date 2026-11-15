import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  uuid,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
const time = (name: string) => timestamp(name, { withTimezone: true });
const created = () => time('created_at').notNull().defaultNow();
const updated = () => time('updated_at').notNull().defaultNow();
export const user = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: created(),
    updatedAt: updated(),
    singleton: boolean('singleton').notNull().default(true),
  },
  (t) => [
    uniqueIndex('one_owner').on(t.singleton),
    check('owner_true', sql`${t.singleton} = true`),
  ],
);
export const session = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: time('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: created(),
    updatedAt: updated(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('sessions_user').on(t.userId)],
);
export const account = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: time('access_token_expires_at'),
    refreshTokenExpiresAt: time('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index('accounts_user').on(t.userId)],
);
export const verification = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: time('expires_at').notNull(),
  createdAt: created(),
  updatedAt: updated(),
});
export const rateLimit = pgTable('rate_limits', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});
export const folders = pgTable(
  'folders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id),
    parentId: uuid('parent_id').references((): AnyPgColumn => folders.id),
    purgeRequestedAt: time('purge_requested_at'),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    passwordHash: text('password_hash'),
    createdAt: created(),
    updatedAt: updated(),
    deletedAt: time('deleted_at'),
    deletionRootId: uuid('deletion_root_id'),
  },
  (t) => [
    index('folder_children').on(t.ownerId, t.parentId),
    uniqueIndex('folder_sibling_name')
      .on(
        t.ownerId,
        sql`coalesce(${t.parentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        sql`lower(${t.name})`,
      )
      .where(sql`${t.deletedAt} is null`),
  ],
);
export const folderUnlocks = pgTable(
  'folder_unlocks',
  {
    folderId: uuid('folder_id')
      .notNull()
      .references(() => folders.id, { onDelete: 'cascade' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => session.id, { onDelete: 'cascade' }),
    expiresAt: time('expires_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.folderId, table.sessionId] }),
    index('folder_unlocks_session').on(table.sessionId, table.expiresAt),
  ],
);
export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id),
    folderId: uuid('folder_id').references(() => folders.id, {
      onDelete: 'set null',
    }),
    displayName: text('display_name').notNull(),
    originalFilename: text('original_filename').notNull(),
    description: text('description').notNull().default(''),
    mimeType: text('mime_type').notNull(),
    extension: text('extension').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    r2ObjectKey: text('r2_object_key').notNull().unique(),
    checksum: text('checksum'),
    width: integer('width'),
    height: integer('height'),
    pageCount: integer('page_count'),
    thumbnailKey: text('thumbnail_key'),
    thumbnailBytes: bigint('thumbnail_bytes', { mode: 'number' })
      .notNull()
      .default(0),
    uploadStatus: text('upload_status').notNull().default('pending'),
    processingStatus: text('processing_status').notNull().default('pending'),
    processingVersion: integer('processing_version').notNull().default(0),
    createdAt: created(),
    updatedAt: updated(),
    lastAccessedAt: time('last_accessed_at'),
    deletedAt: time('deleted_at'),
    deletionRootId: uuid('deletion_root_id'),
    starredAt: time('starred_at'),
  },
  (t) => [
    index('files_owner_folder').on(t.ownerId, t.folderId, t.deletedAt),
    index('files_created').on(t.createdAt, t.id),
    index('files_mime').on(t.mimeType),
    index('files_starred').on(t.starredAt),
    index('files_checksum').on(t.checksum),
    check('file_size_positive', sql`${t.sizeBytes} > 0`),
  ],
);
export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: created(),
  updatedAt: updated(),
  deletedAt: time('deleted_at'),
});
export const collectionFiles = pgTable(
  'collection_files',
  {
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    createdAt: created(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.fileId] }),
    index('membership_file').on(t.fileId),
  ],
);
export const uploads = pgTable(
  'uploads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    targetFolderId: uuid('target_folder_id').references(() => folders.id, {
      onDelete: 'set null',
    }),
    uploadSessionId: text('upload_session_id'),
    objectKey: text('object_key').notNull(),
    expectedSize: bigint('expected_size', { mode: 'number' }).notNull(),
    expectedMimeType: text('expected_mime_type').notNull(),
    checksum: text('checksum'),
    status: text('status').notNull().default('pending'),
    errorCode: text('error_code'),
    createdAt: created(),
    updatedAt: updated(),
    completedAt: time('completed_at'),
    expiresAt: time('expires_at').notNull(),
  },
  (t) => [index('uploads_status_expiry').on(t.status, t.expiresAt)],
);
export const pdfAnnotations = pgTable(
  'pdf_annotations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    pageNumber: integer('page_number').notNull(),
    annotationType: text('annotation_type').notNull(),
    selectedText: text('selected_text'),
    anchorData: jsonb('anchor_data').$type<Record<string, unknown>>(),
    geometryData:
      jsonb('geometry_data').$type<
        { x: number; y: number; width: number; height: number }[]
      >(),
    color: text('color').notNull().default('#fde047'),
    note: text('note').notNull().default(''),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index('annotations_file').on(t.fileId)],
);
export const pdfBookmarks = pgTable('pdf_bookmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id')
    .notNull()
    .references(() => files.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number').notNull(),
  label: text('label').notNull(),
  createdAt: created(),
});
export const pdfReadingProgress = pgTable('pdf_reading_progress', {
  fileId: uuid('file_id')
    .primaryKey()
    .references(() => files.id, { onDelete: 'cascade' }),
  pageNumber: integer('page_number').notNull(),
  zoomLevel: integer('zoom_level').notNull().default(100),
  updatedAt: updated(),
});
export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    passwordHash: text('password_hash'),
    expiresAt: time('expires_at'),
    revokedAt: time('revoked_at'),
    createdAt: created(),
    lastAccessedAt: time('last_accessed_at'),
    accessCount: integer('access_count').notNull().default(0),
  },
  (table) => [
    index('share_links_file_created').on(table.fileId, table.createdAt),
  ],
);
export const shareViewers = pgTable(
  'share_viewers',
  {
    shareId: uuid('share_id')
      .notNull()
      .references(() => shareLinks.id, { onDelete: 'cascade' }),
    viewerHash: text('viewer_hash').notNull(),
    lastSeenAt: time('last_seen_at').notNull().defaultNow(),
    expiresAt: time('expires_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.shareId, table.viewerHash] }),
    index('share_viewers_live').on(table.shareId, table.lastSeenAt),
  ],
);
export const activityEvents = pgTable(
  'activity_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id),
    fileId: uuid('file_id').references(() => files.id, {
      onDelete: 'set null',
    }),
    eventType: text('event_type').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: created(),
  },
  (t) => [index('activity_recent').on(t.ownerId, t.createdAt)],
);
export const processingJobs = pgTable(
  'processing_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    jobType: text('job_type').notNull(),
    generation: integer('generation').notNull().default(0),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: created(),
    updatedAt: updated(),
    completedAt: time('completed_at'),
  },
  (t) => [index('jobs_status').on(t.status, t.updatedAt)],
);
export const settings = pgTable('settings', {
  ownerId: text('owner_id')
    .primaryKey()
    .references(() => user.id),
  maxUploadBytes: bigint('max_upload_bytes', { mode: 'number' }),
  storageQuotaBytes: bigint('storage_quota_bytes', { mode: 'number' }),
  warningBytes: bigint('warning_bytes', { mode: 'number' }),
  trashRetentionDays: integer('trash_retention_days'),
  updatedAt: updated(),
});
