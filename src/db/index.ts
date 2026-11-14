import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';
neonConfig.webSocketConstructor = ws;
let cached: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function db() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      'DATABASE_URL is required. Configure Neon before using the vault.',
    );
  return (cached ??= drizzle(
    new Pool({ connectionString: process.env.DATABASE_URL }),
    { schema },
  ));
}
