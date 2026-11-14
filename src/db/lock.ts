import { sql } from 'drizzle-orm';
// One owner, one hierarchy write namespace. An advisory transaction lock avoids
// blocking auth/foreign-key reads while serializing folder and upload commits.
export const vaultWriteLock = sql`select pg_advisory_xact_lock(862198713)`;
