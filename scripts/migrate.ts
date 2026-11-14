import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { db } from '../src/db';
async function main() {
  await migrate(db(), { migrationsFolder: './src/db/migrations' });
  console.log('Database migrations applied.');
}
main()
  .then(() => process.exit(0))
  .catch(() => {
    console.error(
      'Migration failed. Check Neon connectivity, extension permissions and migration state.',
    );
    process.exit(1);
  });
