import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
import { sql } from 'drizzle-orm';
import { HeadBucketCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3';
import { db } from '../src/db';
import { r2 } from '../src/lib/storage';
function databaseFailure(error: unknown, depth = 0): unknown {
  if (depth > 3 || typeof error !== 'object' || error === null)
    return undefined;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return {
    name: error instanceof Error ? error.name : 'UnknownError',
    classification:
      message.includes('password') || message.includes('authentication')
        ? 'AUTHENTICATION'
        : message.includes('websocket') ||
            message.includes('connect') ||
            message.includes('fetch')
          ? 'CONNECTION'
          : message.includes('relation') || message.includes('column')
            ? 'SCHEMA'
            : 'QUERY',
    ...('code' in error &&
    typeof error.code === 'string' &&
    /^(?:[0-9A-Z]{5}|ECONNRESET|ENOTFOUND|ECONNREFUSED|ETIMEDOUT)$/.test(
      error.code,
    )
      ? { code: error.code }
      : {}),
    ...('cause' in error
      ? { cause: databaseFailure(error.cause, depth + 1) }
      : {}),
  };
}
async function main() {
  try {
    const result = await db().execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name`,
    );
    console.log(
      JSON.stringify({
        databaseConnected: true,
        publicTables: result.rows.map((row) => row.table_name),
      }),
    );
    if (result.rows.some((row) => row.table_name === 'users')) {
      const owner = await db().execute<{ count: number; matches: boolean }>(
        sql`select count(*)::int as count,coalesce(bool_and(lower(email)=lower(${process.env.OWNER_EMAIL ?? ''})),false) as matches from users`,
      );
      console.log(
        JSON.stringify({
          ownerCount: owner.rows[0].count,
          ownerMatchesProvisioningEmail: owner.rows[0].matches,
        }),
      );
    }
  } catch (error) {
    console.log(
      JSON.stringify({
        databaseConnected: false,
        failure: databaseFailure(error),
      }),
    );
  }
  try {
    await r2().send(
      new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME }),
    );
    console.log(JSON.stringify({ r2BucketAccessible: true }));
  } catch (error) {
    console.log(
      JSON.stringify({
        r2BucketAccessible: false,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
  }
  try {
    const cors = await r2().send(
      new GetBucketCorsCommand({ Bucket: process.env.R2_BUCKET_NAME }),
    );
    const origin = process.env.BETTER_AUTH_URL
      ? new URL(process.env.BETTER_AUTH_URL).origin
      : '';
    console.log(
      JSON.stringify({
        r2CorsReadable: true,
        exactAppOriginAllowed:
          cors.CORSRules?.some(
            (rule) =>
              rule.AllowedOrigins?.includes(origin) &&
              rule.AllowedMethods?.includes('PUT'),
          ) ?? false,
        wildcardOrigins:
          cors.CORSRules?.some((rule) => rule.AllowedOrigins?.includes('*')) ??
          false,
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        r2CorsReadable: false,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
  }
  console.log(
    JSON.stringify({
      appOriginIsLoopback: process.env.BETTER_AUTH_URL
        ? ['localhost', '127.0.0.1'].includes(
            new URL(process.env.BETTER_AUTH_URL).hostname,
          )
        : false,
      ownerPasswordMeetsProvisioningPolicy:
        (process.env.OWNER_PASSWORD?.length ?? 0) >= 8,
    }),
  );
}
main()
  .then(() => process.exit(0))
  .catch(() => {
    console.error('Service inspection failed. No credentials were printed.');
    process.exit(1);
  });
