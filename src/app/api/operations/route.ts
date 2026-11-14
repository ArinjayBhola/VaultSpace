import { z } from 'zod';
import { owner } from '@/lib/auth';
import { originGuard, readJSON, respond } from '@/lib/api';
import { advanceOperations } from '@/features/processing/service';
export const maxDuration = 120;
export async function POST(request: Request) {
  return respond(async () => {
    originGuard(request);
    const user = await owner();
    const input = z
      .object({ maintenance: z.boolean().default(false) })
      .strict()
      .parse(await readJSON(request));
    return advanceOperations(user.id, input.maintenance);
  });
}
