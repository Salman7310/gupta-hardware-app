import {
  BACKUP_APP,
  BACKUP_FORMAT,
  backupFileName,
  buildBackup,
  countRows,
  readBackup,
} from '../backup';

const tables = {
  products: [{ id: 'p1', name: 'Makrana White Marble' }],
  invoices: [{ id: 'i1', invoice_no: 'GH/A/0001' }, { id: 'i2', invoice_no: 'GH/A/0002' }],
  settings: [],
};

const written = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ ...buildBackup('shop-1', 'Gupta Home Solutions', 1_759_000_000_000, tables), ...over });

describe('naming a backup', () => {
  /** So a folder of backups sorts by date and the shop can find yesterday's. */
  it('carries the date and time the shop would look for', () => {
    const at = new Date(2026, 8, 27, 9, 5).getTime();
    expect(backupFileName(at)).toBe('gupta-backup-2026-09-27-0905.json');
  });
});

describe('writing a backup', () => {
  it('stamps it with the app, the format and the shop', () => {
    const file = buildBackup('shop-1', 'Gupta Home Solutions', 123, tables);

    expect(file.app).toBe(BACKUP_APP);
    expect(file.format).toBe(BACKUP_FORMAT);
    expect(file.shopId).toBe('shop-1');
    expect(file.shopName).toBe('Gupta Home Solutions');
  });

  it('counts what is in it, so a restore can be confirmed before it runs', () => {
    expect(countRows(tables)).toEqual({ products: 1, invoices: 2, settings: 0 });
  });
});

describe('reading a backup back', () => {
  it('round-trips every row', () => {
    const result = readBackup(written());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tables.invoices).toHaveLength(2);
    expect(result.value.tables.products[0].name).toBe('Makrana White Marble');
    expect(result.value.shopName).toBe('Gupta Home Solutions');
  });

  it('refuses a file that is not JSON at all', () => {
    const result = readBackup('this is a photo, not a backup');
    expect(!result.ok && result.error.code).toBe('backup.unreadable');
  });

  it('refuses a backup from some other app', () => {
    const result = readBackup(JSON.stringify({ app: 'some-other-app', format: 1, tables: {} }));
    expect(!result.ok && result.error.code).toBe('backup.notOurs');
  });

  /**
   * A newer format could hold tables this build knows nothing about, and
   * restoring it would quietly drop them.
   */
  it('refuses a backup from a newer version rather than dropping what it cannot read', () => {
    const result = readBackup(written({ format: BACKUP_FORMAT + 1 }));
    expect(!result.ok && result.error.code).toBe('backup.tooNew');
  });

  it('accepts a backup from an older format', () => {
    expect(readBackup(written({ format: 1 })).ok).toBe(true);
  });

  it('refuses a damaged section rather than restoring half a shop', () => {
    const result = readBackup(written({ tables: { products: 'not rows' } }));
    expect(!result.ok && result.error.code).toBe('backup.corrupt');
  });

  it('refuses a file with no tables', () => {
    const result = readBackup(JSON.stringify({ app: BACKUP_APP, format: 1 }));
    expect(!result.ok && result.error.code).toBe('backup.empty');
  });
});
