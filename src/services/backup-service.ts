import { AppError, Result, appError, err, ok } from '../core';
import { Shop } from '../models/shop';
import {
  BackupFile,
  backupFileName,
  buildBackup,
  countRows,
  readBackup,
} from './backup';
import { BackupFiler, BackupRepository, Clock, SettingsRepository } from './ports';
import { SETTINGS } from './settings-keys';

export interface BackupSummary {
  readonly file: BackupFile;
  readonly name: string;
  readonly counts: Readonly<Record<string, number>>;
}

/**
 * Taking a copy of the shop, and putting one back.
 *
 * Restoring is the dangerous half, so it is deliberately two steps: read the
 * file and say what is in it, then replace the database only once the owner
 * has seen those numbers and agreed. A one-tap restore that silently wiped a
 * year of bills is the worst thing this app could do.
 */
export class BackupService {
  constructor(
    private readonly rows: BackupRepository,
    private readonly filer: BackupFiler,
    private readonly clock: Clock,
    private readonly shop: Shop,
    private readonly settings: SettingsRepository,
  ) {}

  /** When the last backup was written, or null if there has never been one. */
  async lastBackupAt(): Promise<number | null> {
    const stored = await this.settings.get(SETTINGS.lastBackupAt);
    const at = stored ? Number(stored) : NaN;
    return Number.isFinite(at) && at > 0 ? at : null;
  }

  /** Writes a backup. Returns where it went, or null if no folder was granted. */
  async write(): Promise<Result<string | null, AppError>> {
    try {
      const at = this.clock.now();
      const tables = await this.rows.dump();
      const file = buildBackup(this.shop.id, this.shop.name, at, tables);
      const written = await this.filer.write(backupFileName(at), JSON.stringify(file));
      // Only once it is actually on disk. A remembered backup that was never
      // written is worse than none, because it stops the warning showing.
      if (written !== null) await this.settings.set(SETTINGS.lastBackupAt, String(at));
      return ok(written);
    } catch (e) {
      return err(
        appError('backup.failed', e instanceof Error ? e.message : 'The backup could not be made.'),
      );
    }
  }

  /**
   * Reads a backup the owner picked and reports what it holds, without
   * touching the database. Null when they dismissed the picker.
   */
  async inspect(): Promise<Result<BackupSummary | null, AppError>> {
    let picked: { name: string; contents: string } | null;
    try {
      picked = await this.filer.pick();
    } catch (e) {
      return err(
        appError('backup.notRead', e instanceof Error ? e.message : 'That file could not be read.'),
      );
    }
    if (!picked) return ok(null);

    const parsed = readBackup(picked.contents);
    if (!parsed.ok) return parsed;

    return ok({ file: parsed.value, name: picked.name, counts: countRows(parsed.value.tables) });
  }

  /**
   * Replaces everything with the backup. Only call this once the owner has
   * seen what `inspect` reported.
   */
  async restore(file: BackupFile): Promise<Result<void, AppError>> {
    try {
      await this.rows.replaceAll(file.tables);
      return ok(undefined);
    } catch (e) {
      return err(
        appError(
          'backup.notRestored',
          e instanceof Error ? e.message : 'The backup could not be restored.',
        ),
      );
    }
  }
}
