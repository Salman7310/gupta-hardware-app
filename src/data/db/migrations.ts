import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
// Generated from drizzle/*.sql by scripts/build-migrations.mjs, which runs as
// part of `npm run db:generate`. Committed so every install applies the same
// schema history rather than creating tables ad hoc at runtime.
import migrations from './migrations.generated';
import { db } from './client';

export interface MigrationState {
  readonly success: boolean;
  readonly error: Error | undefined;
}

export function useDatabaseMigrations(): MigrationState {
  const { success, error } = useMigrations(db, migrations);
  return { success, error };
}
