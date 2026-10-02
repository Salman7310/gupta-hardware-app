import { BACKUP_APP, buildBackup } from '../backup';
import { BackupService } from '../backup-service';
import { aShop } from '../../testing/builders';
import {
  fixedClock,
  InMemoryBackupFiler,
  InMemoryBackupRepository,
  InMemorySettingsRepository,
} from '../../testing/fakes';

const NOW = new Date(2026, 8, 27, 9, 5).getTime();

const tables = { invoices: [{ id: 'i1' }], products: [{ id: 'p1' }, { id: 'p2' }] };

const service = (
  filer = new InMemoryBackupFiler(),
  rows = new InMemoryBackupRepository(tables),
) => {
  const settings = new InMemorySettingsRepository();
  return {
    filer,
    rows,
    settings,
    subject: new BackupService(rows, filer, fixedClock(NOW), aShop(), settings),
  };
};

describe('taking a backup', () => {
  it('writes the whole shop under a dated name', async () => {
    const { filer, subject } = service();
    const written = await subject.write();

    expect(written.ok && written.value).toBe(
      'content://folder/bills/gupta-backup-2026-09-27-0905.json',
    );
    expect(filer.written[0].fileName).toBe('gupta-backup-2026-09-27-0905.json');

    const parsed = JSON.parse(filer.written[0].contents);
    expect(parsed.app).toBe(BACKUP_APP);
    expect(parsed.shopName).toBe('Gupta Hardware');
    expect(parsed.tables.products).toHaveLength(2);
  });

  /** Dismissing the folder picker is a choice, not an error to shout about. */
  it('reports nothing written when no folder was granted', async () => {
    const { subject } = service(new InMemoryBackupFiler(null));
    const written = await subject.write();
    expect(written.ok && written.value).toBeNull();
  });

  it('remembers when it ran, so the screen can stop warning', async () => {
    const { subject } = service();
    expect(await subject.lastBackupAt()).toBeNull();

    await subject.write();

    expect(await subject.lastBackupAt()).toBe(NOW);
  });

  /**
   * A remembered backup that was never written is worse than none: the
   * warning would stop showing while the shop still had no copy.
   */
  it('remembers nothing when no folder was granted', async () => {
    const { subject } = service(new InMemoryBackupFiler(null));
    await subject.write();
    expect(await subject.lastBackupAt()).toBeNull();
  });
});

describe('restoring a backup', () => {
  const file = buildBackup('shop-1', 'Gupta Home Solutions', NOW, tables);
  const onDisk = { name: 'gupta-backup.json', contents: JSON.stringify(file) };

  /**
   * Inspect must not touch the database. Replacing a year of bills on a
   * mis-tap is the worst thing this app could do, so the numbers come first.
   */
  it('reports what a backup holds without changing anything', async () => {
    const rows = new InMemoryBackupRepository({ invoices: [{ id: 'live' }] });
    const { subject } = service(new InMemoryBackupFiler('content://f', onDisk), rows);

    const seen = await subject.inspect();

    expect(seen.ok && seen.value?.counts).toEqual({ invoices: 1, products: 2 });
    expect(seen.ok && seen.value?.file.shopName).toBe('Gupta Home Solutions');
    expect(rows.tables.invoices).toEqual([{ id: 'live' }]);
  });

  it('says nothing when the picker is dismissed', async () => {
    const { subject } = service(new InMemoryBackupFiler('content://f', null));
    const seen = await subject.inspect();
    expect(seen.ok && seen.value).toBeNull();
  });

  it('reports a file that is not one of ours rather than trying it', async () => {
    const junk = { name: 'photo.jpg', contents: 'not json' };
    const { subject } = service(new InMemoryBackupFiler('content://f', junk));

    const seen = await subject.inspect();
    expect(!seen.ok && seen.error.code).toBe('backup.unreadable');
  });

  it('replaces everything only when told to', async () => {
    const rows = new InMemoryBackupRepository({ invoices: [{ id: 'live' }] });
    const { subject } = service(new InMemoryBackupFiler('content://f', onDisk), rows);

    const restored = await subject.restore(file);

    expect(restored.ok).toBe(true);
    expect(rows.tables.products).toHaveLength(2);
    expect(rows.tables.invoices).toEqual([{ id: 'i1' }]);
  });

  /**
   * The settings inside a backup are a copy taken just before the backup's
   * own time was written down, so restoring one wiped the record of it and
   * the Shop screen said "Nothing is backed up yet" — right after a restore.
   */
  it('remembers the restored backup as one the shop has', async () => {
    const { subject } = service(new InMemoryBackupFiler('content://f', onDisk));

    await subject.restore(file);

    expect(await subject.lastBackupAt()).toBe(NOW);
  });

  it('keeps a later backup time than the one restored', async () => {
    const { subject, settings } = service(new InMemoryBackupFiler('content://f', onDisk));
    await settings.set('backup.lastAt', String(NOW + 86_400_000));

    await subject.restore(file);

    expect(await subject.lastBackupAt()).toBe(NOW + 86_400_000);
  });
});
