import { openEncryptedDatabase, type Database } from '../data/db/client';
import { getOrCreateDatabaseKey } from '../data/db/database-key';
import { runMigrations } from '../data/db/migrations';
import { ExpoSecureKeyStore } from '../data/secure-store';
import { createPlatformServices, type PlatformServices } from './platform';

export interface AppRuntime {
  readonly db: Database;
  readonly platform: PlatformServices;
}

/**
 * Brings the app up, in the only order that works: the encryption key has to
 * exist before the database can be opened, the database has to be open before
 * migrations can run, and the schema has to exist before settings can be read
 * to find out which shop this is.
 */
export async function bootstrapApp(): Promise<AppRuntime> {
  const secure = new ExpoSecureKeyStore();
  const key = await getOrCreateDatabaseKey(secure);
  const db = await openEncryptedDatabase(key);
  await runMigrations(db);

  return { db, platform: createPlatformServices(db, secure) };
}
