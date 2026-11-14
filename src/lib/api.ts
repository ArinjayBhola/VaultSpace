import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { ApiError } from './auth';
import { S3ServiceException } from '@aws-sdk/client-s3';
export async function readJSON(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new ApiError(415, 'JSON_REQUIRED', 'Send a JSON request body.');
  const reader = request.body?.getReader();
  if (!reader)
    throw new ApiError(400, 'BODY_REQUIRED', 'A request body is required.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 262144) {
        await reader.cancel();
        throw new ApiError(
          413,
          'BODY_TOO_LARGE',
          'The request body exceeds 256 KB.',
        );
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  const parsed: unknown = JSON.parse(new TextDecoder().decode(body));
  return parsed;
}
export function originGuard(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.BETTER_AUTH_URL;
  if (!expected || origin !== new URL(expected).origin)
    throw new ApiError(
      403,
      'INVALID_ORIGIN',
      'This request origin is not permitted.',
    );
}
export async function respond(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (e) {
    if (e instanceof S3ServiceException && e.name === 'AccessDenied') {
      console.error('r2_object_access_denied');
      return NextResponse.json(
        {
          error: {
            code: 'R2_ACCESS_DENIED',
            message:
              'R2 denied this object operation. Verify that the S3 API token has Object Read & Write access to the configured bucket, then restart the app after updating credentials.',
          },
        },
        { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }
    if (e instanceof SyntaxError)
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON.',
          },
        },
        { status: 400 },
      );
    const databaseError = z
      .object({ cause: z.object({ code: z.string() }) })
      .safeParse(e);
    if (
      databaseError.success &&
      ['23505', '23514'].includes(databaseError.data.cause.code)
    )
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message:
              'This name already exists in the destination, or the operation violates a data constraint. Choose another name or destination.',
          },
        },
        { status: 409 },
      );
    if (e instanceof ApiError)
      return NextResponse.json(
        { error: { code: e.code, message: e.message } },
        { status: e.status },
      );
    if (e instanceof ZodError)
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: e.issues.map((i) => i.message).join('; '),
          },
        },
        { status: 400 },
      );
    console.error(
      'vault_request_failed',
      e instanceof Error ? e.name : 'UnknownError',
    );
    return NextResponse.json(
      {
        error: {
          code: 'SERVICE_ERROR',
          message:
            'The service could not complete this request. Check configuration and retry.',
        },
      },
      { status: 503 },
    );
  }
}
