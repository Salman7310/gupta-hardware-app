import { requireNativeModule } from 'expo-modules-core';

export interface ShareFileOptions {
  /** A file:// uri, as the print engine returns. */
  readonly uri: string;
  readonly mimeType?: string;
  /** Null or absent sends through the system chooser. */
  readonly packageName?: string;
  /** A caption alongside the file. */
  readonly text?: string;
  /** For example 919812345678@s.whatsapp.net, to open one contact's chat. */
  readonly jid?: string;
}

interface WhatsappShareModule {
  isAppInstalled(packageName: string): boolean;
  shareFile(options: ShareFileOptions): Promise<void>;
}

export default requireNativeModule<WhatsappShareModule>('WhatsappShare');
