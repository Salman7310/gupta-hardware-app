import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  StorageAccessFramework,
  cacheDirectory,
  deleteAsync,
  moveAsync,
  readAsStringAsync,
} from 'expo-file-system/legacy';
import WhatsappShare from '../../modules/whatsapp-share/src';
import { DocumentFiler, SettingsRepository } from '../services/ports';
import { SETTINGS, filedDocumentKey } from '../services/settings-keys';

const PDF_MIME = 'application/pdf';

/** Ordinary WhatsApp first, then Business, which many shops run instead. */
const WHATSAPP_PACKAGES = ['com.whatsapp', 'com.whatsapp.w4b'] as const;

/**
 * Documents on disk, via the system print engine and the Storage Access
 * Framework. Bills and quotations both come through here.
 *
 * The saved copy deliberately lives in a folder the owner nominates, not in
 * the app's own directory. Android deletes everything an app owns when it is
 * uninstalled, and the whole point of keeping a bill is that it outlives the
 * app, the phone and this shop's choice of software.
 */
export class ExpoDocumentFiler implements DocumentFiler {
  constructor(private readonly settings: SettingsRepository) {}

  /**
   * A4, in points. The print engine defaults to US Letter, which is not the
   * paper any shop in India owns: a bill laid out for Letter comes out of an
   * A4 printer with the margins wrong.
   */
  private static readonly A4 = { width: 595, height: 842 };

  async render(html: string): Promise<string> {
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
      ...ExpoDocumentFiler.A4,
    });
    return uri;
  }

  async share(fileUri: string, fileName: string): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('This device has nothing to share with.');
    }
    await Sharing.shareAsync(await this.named(fileUri, fileName), {
      mimeType: PDF_MIME,
      dialogTitle: fileName,
      UTI: 'com.adobe.pdf',
    });
  }

  /**
   * The print engine writes to a cache file named after a random id, and the
   * share sheet passes that name on. A customer receiving
   * "384d795d-e756-42ea.pdf" on WhatsApp cannot tell what it is, so the file
   * is renamed to the document number before it leaves the app.
   */
  private async named(fileUri: string, fileName: string): Promise<string> {
    if (!cacheDirectory) return fileUri;

    const target = `${cacheDirectory}${fileName}`;
    if (target === fileUri) return fileUri;

    try {
      await deleteAsync(target, { idempotent: true });
      await moveAsync({ from: fileUri, to: target });
      return target;
    } catch {
      // A readable name is worth having but not worth failing the share over.
      return fileUri;
    }
  }

  private whatsAppPackage(): string | null {
    return WHATSAPP_PACKAGES.find((name) => WhatsappShare.isAppInstalled(name)) ?? null;
  }

  async canShareOnWhatsApp(): Promise<boolean> {
    return this.whatsAppPackage() !== null;
  }

  async shareOnWhatsApp(
    fileUri: string,
    fileName: string,
    message: string,
    jid: string | null,
  ): Promise<void> {
    const packageName = this.whatsAppPackage();
    if (!packageName) throw new Error('WhatsApp is not installed on this phone.');

    // Renamed first for the same reason as an ordinary share: the customer
    // receives a file called GH-A-0001.pdf rather than a random id.
    await WhatsappShare.shareFile({
      uri: await this.named(fileUri, fileName),
      mimeType: PDF_MIME,
      packageName,
      text: message,
      jid: jid ?? undefined,
    });
  }

  async chosenFolder(): Promise<string | null> {
    return this.settings.get(SETTINGS.billFolderUri);
  }

  async forgetFolder(): Promise<void> {
    await this.settings.set(SETTINGS.billFolderUri, '');
  }

  /**
   * Filings of the same file, chained so they run one after another.
   *
   * Two quick changes to one bill — two payments in a row — each file it
   * again. Run side by side, both deleted the old copy and both created a new
   * one, and the second came out as "GH-A-0001 (1).pdf". In turn, the second
   * finds the first's copy and replaces it.
   */
  private readonly filing = new Map<string, Promise<unknown>>();

  keep(fileUri: string, fileName: string): Promise<string | null> {
    const before = this.filing.get(fileName) ?? Promise.resolve();
    const next = before.catch(() => undefined).then(() => this.keepNow(fileUri, fileName));
    this.filing.set(fileName, next);
    // Let the chain go once it has run out, so the map does not grow forever.
    void next.finally(() => {
      if (this.filing.get(fileName) === next) this.filing.delete(fileName);
    }).catch(() => undefined);
    return next;
  }

  async isKept(fileName: string): Promise<boolean> {
    return (await this.settings.get(filedDocumentKey(fileName))) !== null;
  }

  private async keepNow(fileUri: string, fileName: string): Promise<string | null> {
    const folder = await this.folder();
    if (!folder) return null;

    // Read the rendered PDF back as base64 and write it into the granted
    // folder. A SAF uri is not a path, so nothing here can copy file to file.
    const contents = await readAsStringAsync(fileUri, { encoding: 'base64' });

    try {
      await this.removeEarlierCopy(folder, fileName);
      const target = await StorageAccessFramework.createFileAsync(folder, fileName, PDF_MIME);
      await StorageAccessFramework.writeAsStringAsync(target, contents, { encoding: 'base64' });
      await this.settings.set(filedDocumentKey(fileName), target);
      return target;
    } catch (e) {
      // A permission survives a reboot but not the folder being deleted or the
      // grant being revoked in settings. Rather than fail for good, forget it
      // so the next save asks for a folder again.
      await this.forgetFolder();
      throw e instanceof Error ? e : new Error('The bills folder could not be written to.');
    }
  }

  /**
   * Deletes the copy of this document filed last time, so the one about to be
   * written replaces it under the same name.
   *
   * Delete-then-create rather than writing over the old file: the Storage
   * Access Framework cannot rename, and writing a shorter PDF into a longer
   * one is not guaranteed to truncate on every provider, which would leave the
   * old file's tail — its own trailer and xref — hanging off the new one.
   *
   * Only an exact name is touched. A "GH-A-0001 (1).pdf" left by an older
   * build, or anything the owner put in the folder, is left alone.
   */
  private async removeEarlierCopy(folder: string, fileName: string): Promise<void> {
    const remembered = await this.settings.get(filedDocumentKey(fileName));
    const earlier = remembered
      ? [remembered]
      : (await StorageAccessFramework.readDirectoryAsync(folder)).filter(
          (uri) => nameInUri(uri) === fileName,
        );

    for (const uri of earlier) {
      try {
        await StorageAccessFramework.deleteAsync(uri, { idempotent: true });
      } catch {
        // Already gone, moved by the owner, or from a phone this backup was
        // restored from. None of that should stop the new copy being written.
      }
    }
  }

  /** The chosen folder, asking for one the first time. Null if the owner declines. */
  private async folder(): Promise<string | null> {
    const saved = await this.chosenFolder();
    if (saved) return saved;

    const granted = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!granted.granted) return null;

    await this.settings.set(SETTINGS.billFolderUri, granted.directoryUri);
    return granted.directoryUri;
  }
}

/**
 * The file name a Storage Access Framework uri points at, where the provider
 * puts it in the uri — the phone's own storage does, as
 * `.../document/primary%3ADocuments%2FGH-A-0001.pdf`. Providers that use
 * opaque ids yield something that matches no file name, which is safe.
 */
function nameInUri(uri: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(uri);
  } catch {
    return '';
  }
  return decoded.slice(decoded.lastIndexOf('/') + 1);
}
