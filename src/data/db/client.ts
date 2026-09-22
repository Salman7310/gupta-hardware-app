import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import * as schema from './schema';

export const DATABASE_NAME = 'gupta-hardware.db';

export type Database = ExpoSQLiteDatabase<typeof schema>;

/**
 * Opens the database under SQLCipher.
 *
 * The key must be the first statement executed on the connection: SQLCipher
 * decides then whether the file is readable at all. A raw hex key is used
 * rather than a passphrase so no key derivation runs on every open.
 *
 * Note that this key is bound to this phone's Keystore. The Sprint 5 backup
 * must be encrypted with a passphrase the owner chooses instead, or a backup
 * could never be restored onto a replacement device.
 */
export async function openEncryptedDatabase(hexKey: string): Promise<Database> {
  const connection = await SQLite.openDatabaseAsync(DATABASE_NAME, {
    enableChangeListener: true,
  });
  await connection.execAsync(`PRAGMA key = "x'${hexKey}'"`);
  // Fails loudly here rather than on the first query if the key is wrong.
  await connection.execAsync('SELECT count(*) FROM sqlite_master;');
  return drizzle(connection, { schema });
}

export { schema };
