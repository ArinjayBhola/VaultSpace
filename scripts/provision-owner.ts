import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db } from '../src/db';
import { user, account, settings } from '../src/db/schema';
async function main() {
  const input = z
    .object({
      OWNER_EMAIL: z.email(),
      OWNER_PASSWORD: z.string().min(8).max(128),
      OWNER_NAME: z.string().min(1).default('Owner'),
    })
    .parse(process.env);
  const password = await hashPassword(input.OWNER_PASSWORD);
  await db().transaction(async (tx) => {
    const id = randomUUID();
    await tx.insert(user).values({
      id,
      name: input.OWNER_NAME,
      email: input.OWNER_EMAIL.toLowerCase(),
      emailVerified: true,
    });
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: id,
      providerId: 'credential',
      userId: id,
      password,
    });
    await tx.insert(settings).values({ ownerId: id });
  });
  console.log(
    'Owner provisioned. Remove OWNER_PASSWORD from your environment. Public registration remains disabled.',
  );
}
main()
  .then(() => process.exit(0))
  .catch(() => {
    console.error(
      'Provisioning failed: check configuration, password policy, migrations, and whether an owner already exists.',
    );
    process.exit(1);
  });
