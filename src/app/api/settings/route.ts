import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { owner } from '@/lib/auth';
import { originGuard, respond, readJSON } from '@/lib/api';
export async function GET() {
  return respond(async () => {
    const user = await owner();
    const [prefs] = await db()
      .select()
      .from(settings)
      .where(eq(settings.ownerId, user.id));
    return {
      settings: prefs,
      uploadLimit: Math.min(
        Number(process.env.MAX_UPLOAD_BYTES || 1073741824),
        5 * 1024 ** 3,
      ),
      user: { name: user.name, email: user.email },
    };
  });
}
const schema = z.object({
  maxUploadBytes: z.number().int().positive().nullable(),
  storageQuotaBytes: z.number().int().positive().nullable(),
  warningBytes: z.number().int().positive().nullable(),
  trashRetentionDays: z.number().int().min(1).max(3650).nullable(),
});
export async function POST(request: Request) {
  return respond(async () => {
    originGuard(request);
    const user = await owner();
    const input = schema.parse(await readJSON(request));
    await db()
      .insert(settings)
      .values({ ownerId: user.id, ...input })
      .onConflictDoUpdate({
        target: settings.ownerId,
        set: { ...input, updatedAt: new Date() },
      });
    return { success: true };
  });
}
