import { auth } from '@/lib/auth';
import { respond } from '@/lib/api';
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
    return await auth().handler(req);
  } catch (e) {
    return respond(async () => {
      throw e;
    });
  }
}
