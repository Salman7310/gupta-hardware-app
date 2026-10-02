export const SETTINGS = {
  shopId: 'shop.id',
  shopName: 'shop.name',
  shopAddress: 'shop.address',
  shopPhone: 'shop.phone',
  shopGstin: 'shop.gstin',
  invoicePrefix: 'shop.invoicePrefix',
  /**
   * The folder the owner picked for saved bills, as a Storage Access Framework
   * uri. Held in settings rather than secure storage because losing it costs
   * one more tap on the picker, not any data.
   */
  billFolderUri: 'bills.folderUri',
  /**
   * When the last backup was written. Kept so the Shop screen can say "never
   * backed up" out loud: a shopkeeper who has not noticed the button has no
   * backup, and nothing on screen tells them so.
   */
  lastBackupAt: 'backup.lastAt',
} as const;

export const SECURE = {
  deviceId: 'device.id',
  deviceLetter: 'device.letter',
  databaseKey: 'database.key',
} as const;

/**
 * Where a document was last written in the shop's folder, by file name.
 *
 * A bill is filed again whenever it changes — a payment, more items, a
 * cancellation — and the folder should hold its latest state once, not a
 * "GH-A-0001 (1).pdf" beside the stale one. Remembering the uri is what lets
 * the old copy be found on any storage provider, including ones whose uris do
 * not carry the file's name.
 */
export const filedDocumentKey = (fileName: string): string => `files.${fileName}`;

/** One counter per device letter, so each invoice series stays consecutive. */
export const invoiceSequenceKey = (letter: string): string => `invoice.seq.${letter}`;

/**
 * Quotations count on their own, so an estimate that never becomes a sale
 * cannot leave a gap in the invoice series.
 */
export const quotationSequenceKey = (letter: string): string => `quotation.seq.${letter}`;
