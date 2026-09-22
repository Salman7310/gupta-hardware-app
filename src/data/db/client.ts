import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import * as schema from './schema';

export const DATABASE_NAME = 'gupta-hardware.db';

/**
 * TODO (Sprint 1): open this through SQLCipher with a key held in
 * expo-secure-store, and encrypt the exported backup with an owner passphrase
 * instead — a Keystore key is bound to one phone and would make a backup
 * unreadable on a replacement device.
 */
const connection = SQLite.openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

export const db = drizzle(connection, { schema });

export type Database = typeof db;
export { schema };
