import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
import { randomUUID } from 'node:crypto';
import { HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { r2, signPut } from '../src/lib/storage';
async function main() {
  for (const [operation, command] of [
    [
      'HeadBucket',
      new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME }),
    ],
    [
      'ListObjects',
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: 'staging/',
        MaxKeys: 1,
      }),
    ],
  ] as const) {
    try {
      await r2().send(command);
      console.log(JSON.stringify({ operation, allowed: true }));
    } catch (error) {
      console.log(
        JSON.stringify({
          operation,
          allowed: false,
          errorCode: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
    }
  }
  const origin = new URL(process.env.BETTER_AUTH_URL || 'http://localhost:3000')
    .origin;
  // Signing and OPTIONS do not upload, delete, or modify any storage object.
  const url = await signPut(
    `staging/diagnostic-${randomUUID()}`,
    'application/pdf',
    1,
  );
  const response = await fetch(url, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  console.log(
    JSON.stringify({
      operation: 'BrowserUploadPreflight',
      origin,
      status: response.status,
      allowedOrigin: response.headers.get('access-control-allow-origin'),
      allowedMethods: response.headers.get('access-control-allow-methods'),
      allowedHeaders: response.headers.get('access-control-allow-headers'),
      signedHeaders: new URL(url).searchParams.get('X-Amz-SignedHeaders'),
    }),
  );
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(
      'R2 upload inspection failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    process.exit(1);
  });
