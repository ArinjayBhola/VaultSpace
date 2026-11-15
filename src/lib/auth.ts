import { cache } from 'react';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import * as schema from '@/db/schema';
let instance: ReturnType<typeof createAuth> | undefined;
export function auth() {
  return (instance ??= createAuth());
}
function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      'BETTER_AUTH_SECRET must contain at least 32 random characters.',
    );
  if (!process.env.BETTER_AUTH_URL)
    throw new Error('BETTER_AUTH_URL is required.');
  return betterAuth({
    appName: 'VAULTSPACE',
    secret,
    baseURL: process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(db(), { provider: 'pg', schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordChange: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      customRules: { '/sign-in/email': { window: 60, max: 5 } },
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === 'production',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
      ipAddress: {
        ipAddressHeaders: process.env.VERCEL ? ['x-vercel-forwarded-for'] : [],
      },
    },
  });
}
export const ownerSession = cache(async () => {
  const requestHeaders = await headers();
  if (!requestHeaders.get('cookie'))
    throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in to continue.');
  const result = await auth().api.getSession({ headers: requestHeaders });
  if (!result)
    throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in to continue.');
  return result;
});
export const owner = cache(async () => (await ownerSession()).user);
export async function pageOwner() {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET)
    redirect('/login');
  try {
    return await owner();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    throw error;
  }
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
