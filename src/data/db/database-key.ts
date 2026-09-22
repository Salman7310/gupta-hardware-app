import 'react-native-get-random-values';
import { SecureKeyStore } from '../../services/ports';
import { SECURE } from '../../services/settings-keys';

const KEY_BYTES = 32;

function randomHexKey(): string {
  const bytes = new Uint8Array(KEY_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Reads the database key from the Android Keystore, generating one on first
 * run. Losing this key means losing the database, which is precisely why
 * backup (Sprint 5) must not depend on it.
 */
export async function getOrCreateDatabaseKey(secure: SecureKeyStore): Promise<string> {
  const existing = await secure.get(SECURE.databaseKey);
  if (existing) return existing;

  const key = randomHexKey();
  await secure.set(SECURE.databaseKey, key);
  return key;
}
