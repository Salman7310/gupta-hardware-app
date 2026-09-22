import * as SecureStore from 'expo-secure-store';
import { SecureKeyStore } from '../services/ports';

/**
 * Android Keystore backed storage for the device identity and database key.
 *
 * Note for Sprint 5: values here are bound to this phone. The exported backup
 * must therefore be encrypted with a passphrase the owner sets, not with a key
 * from this store, or the backup cannot be restored onto a replacement device.
 */
export class ExpoSecureKeyStore implements SecureKeyStore {
  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  }

  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  }
}
