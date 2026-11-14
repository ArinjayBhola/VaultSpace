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
    return NextResponse.redirect(
      await signGet(file.r2ObjectKey, file.displayName),
      {
        status: 302,
        headers: {
          'Cache-Control': 'private, no-store',
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
