import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { ApiError } from './auth';
import { FILE_CACHE_SECONDS } from './cache-policy';
let client: S3Client | undefined;
export function r2() {
  const configuration = z
    .object({
      R2_ACCOUNT_ID: z.string().min(1),
      R2_ACCESS_KEY_ID: z.string().min(1),
      R2_SECRET_ACCESS_KEY: z.string().min(1),
      R2_BUCKET_NAME: z.string().min(1),
    })
    .safeParse(process.env);
  if (!configuration.success)
    throw new ApiError(
      503,
      'STORAGE_UNCONFIGURED',
      'Configure the private R2 bucket and server credentials before uploading files.',
    );
  const e = configuration.data;
  return (client ??= new S3Client({
    region: 'auto',
    endpoint:
      process.env.R2_ENDPOINT ||
      `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: e.R2_ACCESS_KEY_ID,
      secretAccessKey: e.R2_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  }));
}
const bucket = () => process.env.R2_BUCKET_NAME;
export const headObject = (key: string) =>
  r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
export const getObject = (key: string, range?: string) =>
  r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key, Range: range }));
export const deleteObject = (key: string) =>
  r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
export const copyObject = (
  from: string,
  to: string,
  etag: string,
  mime: string,
) =>
  r2().send(
    new CopyObjectCommand({
      Bucket: bucket(),
      Key: to,
      CopySource: `${bucket()}/${from}`,
      CopySourceIfMatch: etag,
      MetadataDirective: 'REPLACE',
      ContentType: mime,
      CacheControl: 'private, no-store',
    }),
  );
export const putObject = (key: string, body: Uint8Array, mime: string) =>
  r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: mime,
    }),
  );
export const signPut = (key: string, mime: string, size: number) =>
  getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: mime,
      ContentLength: size,
    }),
    { expiresIn: 600 },
  );
export const signGet = (key: string, filename: string, revalidate = false) =>
  getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      ResponseCacheControl: revalidate
        ? 'private, no-cache, must-revalidate'
        : `private, max-age=${FILE_CACHE_SECONDS}, must-revalidate`,
    }),
    {
      expiresIn: 120,
      signingDate: new Date(Math.floor(Date.now() / 30000) * 30000),
    },
  );
export const createMultipart = (key: string, mime: string) =>
  r2().send(
    new CreateMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: mime,
    }),
  );
export const signPart = (key: string, uploadId: string, part: number) =>
  getSignedUrl(
    r2(),
    new UploadPartCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      PartNumber: part,
    }),
    { expiresIn: 600 },
  );
export const listParts = (key: string, uploadId: string) =>
  r2().send(
    new ListPartsCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }),
  );
export const completeMultipart = (
  key: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[],
) =>
  r2().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }),
  );
export const abortMultipart = (key: string, uploadId: string) =>
  r2().send(
    new AbortMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
    }),
  );
