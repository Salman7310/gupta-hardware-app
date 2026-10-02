import { AppError, Result, appError, err, ok } from '../core';

/**
 * A whole-shop backup, written into the folder the owner nominated.
 *
 * Deliberately **not** encrypted with the database key. That key lives in the
 * Android Keystore and is destroyed with the app, so a backup locked with it
 * would be unreadable at exactly the moment it is needed — which is the one
 * failure this feature exists to prevent.
 *
 * It is written as plain JSON. The shop's bills are already in that same
 * folder as PDFs, carrying customer names, addresses, phone numbers and
 * amounts in the clear, so this adds no exposure that is not there already.
 * See docs/adr/0006-how-the-shop-is-backed-up.md.
 */

/** One database row, as columns of primitives. */
export type BackupRow = Readonly<Record<string, string | number | null>>;

/** Every table, by name. Kept generic so a new table needs no code here. */
export type BackupTables = Readonly<Record<string, readonly BackupRow[]>>;

export const BACKUP_FORMAT = 1;
export const BACKUP_APP = 'gupta-hardware';

export interface BackupFile {
  readonly app: typeof BACKUP_APP;
  readonly format: number;
  readonly createdAt: number;
  readonly shopId: string;
  readonly shopName: string;
  readonly tables: BackupTables;
}

/** The tables a restore must put back, in an order that reads sensibly. */
export const BACKUP_TABLES = [
  'settings',
  'products',
  'customers',
  'invoices',
  'invoice_items',
  'quotations',
  'quotation_items',
  'stock_movements',
  'payments',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Sorts newest-last in a file listing and carries the date the shopkeeper
 * would look for, rather than an opaque id.
 */
export function backupFileName(at: number): string {
  const d = new Date(at);
  return [
    'gupta-backup-',
    d.getFullYear(),
    '-',
    pad(d.getMonth() + 1),
    '-',
    pad(d.getDate()),
    '-',
    pad(d.getHours()),
    pad(d.getMinutes()),
    '.json',
  ].join('');
}

export function buildBackup(
  shopId: string,
  shopName: string,
  createdAt: number,
  tables: BackupTables,
): BackupFile {
  return { app: BACKUP_APP, format: BACKUP_FORMAT, createdAt, shopId, shopName, tables };
}

/**
 * What the restore screen tells the owner they are about to get back.
 *
 * Rows marked deleted are left out. They are in the file on purpose — a
 * deleted estimate is kept as a marker so another device can learn it went —
 * but counting them said "Quotations 2" to a shop that could see one.
 */
export function countRows(tables: BackupTables): Readonly<Record<string, number>> {
  return Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [
      name,
      rows.filter((row) => row.deleted_at === null || row.deleted_at === undefined).length,
    ]),
  );
}

export const billsInBackup = (file: BackupFile): number => file.tables.invoices?.length ?? 0;
export const productsInBackup = (file: BackupFile): number => file.tables.products?.length ?? 0;

const isRowArray = (value: unknown): value is BackupRow[] =>
  Array.isArray(value) && value.every((row) => typeof row === 'object' && row !== null);

/**
 * Reads a file the owner picked.
 *
 * Every failure is reported rather than guessed at. Restoring half a backup,
 * or a file from another app, would leave the shop worse off than not
 * restoring at all.
 */
export function readBackup(text: string): Result<BackupFile, AppError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return err(appError('backup.unreadable', 'That file is not a backup this app can read.'));
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return err(appError('backup.unreadable', 'That file is not a backup this app can read.'));
  }

  const file = parsed as Partial<BackupFile>;

  if (file.app !== BACKUP_APP) {
    return err(appError('backup.notOurs', 'That backup was made by a different app.'));
  }

  if (typeof file.format !== 'number' || file.format > BACKUP_FORMAT) {
    return err(
      appError(
        'backup.tooNew',
        'That backup was made by a newer version of this app. Update the app and try again.',
      ),
    );
  }

  if (typeof file.tables !== 'object' || file.tables === null) {
    return err(appError('backup.empty', 'That backup has no data in it.'));
  }

  for (const [name, rows] of Object.entries(file.tables)) {
    if (!isRowArray(rows)) {
      return err(appError('backup.corrupt', `The ${name} section of that backup is damaged.`));
    }
  }

  return ok({
    app: BACKUP_APP,
    format: file.format,
    createdAt: typeof file.createdAt === 'number' ? file.createdAt : 0,
    shopId: typeof file.shopId === 'string' ? file.shopId : '',
    shopName: typeof file.shopName === 'string' ? file.shopName : '',
    tables: file.tables as BackupTables,
  });
}
