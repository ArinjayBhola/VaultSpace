import { NextResponse } from 'next/server';
import { owner } from '@/lib/auth';
import { ownedFile } from '@/features/files/service';
import { signGet } from '@/lib/storage';
import { id } from '@/lib/validation';
import { respond } from '@/lib/api';
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await owner();
    const file = await ownedFile(user.id, id.parse((await context.params).id));
    // Keep large downloads off the application server. The signed URL remains
    // valid for at least 90 seconds, beyond the redirect's 60-second cache TTL.
    return NextResponse.redirect(
      await signGet(file.r2ObjectKey, file.displayName, file.folderProtected),
      {
        status: 302,
        headers: {
          'Cache-Control': file.folderProtected
            ? 'private, no-cache, must-revalidate'
            : 'private, max-age=60, must-revalidate',
          Vary: 'Cookie',
          'Referrer-Policy': 'no-referrer',
        },
      },
    );
  } catch (error) {
    return respond(async () => {
      throw error;
    });
  }
}
