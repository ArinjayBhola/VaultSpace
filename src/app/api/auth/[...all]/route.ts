import { auth } from '@/lib/auth';
import { respond } from '@/lib/api';
import { invalidatePrivateBrowserCache } from '@/lib/private-cache';
export async function GET(req: Request) {
  try {
    return await auth().handler(req);
  } catch (e) {
    return respond(async () => {
      throw e;
    });
  }
}
export async function POST(req: Request) {
  try {
    const response = await auth().handler(req);
    const path = new URL(req.url).pathname;
    return /\/(sign-out|sign-in\/email|change-password|revoke-session|revoke-sessions|revoke-other-sessions)$/.test(
      path,
    )
      ? invalidatePrivateBrowserCache(response)
      : response;
  } catch (e) {
    return respond(async () => {
      throw e;
    });
  }
}
