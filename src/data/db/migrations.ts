import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
// Generated from drizzle/*.sql by scripts/build-migrations.mjs, which runs as
// part of `npm run db:generate`. Committed so every install applies the same
// schema history rather than creating tables ad hoc at runtime.
import migrations from './migrations.generated';
import type { Database } from './client';

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, migrations);
}
