import * as DocumentPicker from 'expo-document-picker';
import {
  StorageAccessFramework,
  EncodingType,
  readAsStringAsync,
} from 'expo-file-system/legacy';
import { BackupFiler, SettingsRepository } from '../services/ports';
import { SETTINGS } from '../services/settings-keys';

const JSON_MIME = 'application/json';

/**
 * Backups on disk, in the same folder the shop already keeps its bills.
 *
 * That folder is outside the app sandbox on purpose. A backup written inside
 * the app would be deleted with the app, which is the one moment it matters.
 */
export class ExpoBackupFiler implements BackupFiler {
  constructor(private readonly settings: SettingsRepository) {}

  async write(fileName: string, contents: string): Promise<string | null> {
    const folder = await this.folder();
    if (!folder) return null;

    try {
      const target = await StorageAccessFramework.createFileAsync(folder, fileName, JSON_MIME);
      await StorageAccessFramework.writeAsStringAsync(target, contents, {
        encoding: EncodingType.UTF8,
      });
      return target;
    } catch (e) {
      // The grant survives a reboot but not the folder being deleted. Forget
      // it so the next backup asks again rather than failing for good.
      await this.settings.set(SETTINGS.billFolderUri, '');
      throw e instanceof Error ? e : new Error('The backup could not be written.');
    }
  }

  async pick(): Promise<{ name: string; contents: string } | null> {
    // Deliberately not restricted to application/json: Android file providers
    // label a .json inconsistently, and a picker that shows the file greyed
    // out is worse than one that lets it through and reports a bad file.
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled || picked.assets.length === 0) return null;

    const asset = picked.assets[0];
    const contents = await readAsStringAsync(asset.uri, { encoding: EncodingType.UTF8 });
    return { name: asset.name, contents };
  }

  /** The chosen folder, asking for one the first time. */
  private async folder(): Promise<string | null> {
    const saved = await this.settings.get(SETTINGS.billFolderUri);
    if (saved) return saved;

    const granted = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!granted.granted) return null;

    await this.settings.set(SETTINGS.billFolderUri, granted.directoryUri);
    return granted.directoryUri;
  }
}
