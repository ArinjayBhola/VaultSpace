import { fileTypeFromBuffer } from 'file-type';
import { ApiError } from './auth';
import { safeInline, uploadMime, extensionOf } from './file-types';
export async function verifiedMime(
  bytes: Uint8Array,
  expected: string,
  filename: string,
) {
  let detected;
  try {
    detected = await fileTypeFromBuffer(bytes);
  } catch (error) {
    // Unknown formats may not be identifiable from the bounded header sample.
    // These remain attachment-only; formats rendered inline must still match.
    if (!(error instanceof Error) || error.name !== 'EndOfStreamError') {
      if (safeInline(expected)) throw error;
      console.warn(
        'file_type_detection_unavailable',
        error instanceof Error ? error.name : 'UnknownError',
      );
    }
  }
  if (safeInline(expected) && detected?.mime !== expected)
    throw new ApiError(
      400,
      'SIGNATURE_MISMATCH',
      'File contents do not match the declared preview type.',
    );
  if (
    ['docx', 'xlsx', 'pptx'].includes(extensionOf(filename)) &&
    detected?.mime === 'application/zip'
  )
    return uploadMime(filename, expected);
  return detected?.mime ?? uploadMime(filename, expected);
}
