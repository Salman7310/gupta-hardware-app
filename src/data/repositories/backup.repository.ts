import { sql } from 'drizzle-orm';
import { BACKUP_TABLES, BackupRow, BackupTables } from '../../services/backup';
import { BackupRepository } from '../../services/ports';
import { Database } from '../db/client';

/**
 * Reads and writes whole tables, by name, rather than through the typed
 * query builder.
 *
 * A backup has to carry every column as stored — including the sync columns
 * and any column a later migration adds — so it is driven by what the
 * database actually has rather than by a hand-written list of fields that
 * would silently fall behind the schema.
 */
export class DrizzleBackupRepository implements BackupRepository {
  constructor(private readonly db: Database) {}

  async dump(): Promise<BackupTables> {
    const tables: Record<string, BackupRow[]> = {};

    for (const name of BACKUP_TABLES) {
      const rows = await this.db.all<BackupRow>(sql.raw(`SELECT * FROM ${name}`));
      tables[name] = rows;
    }

    return tables;
  }

  async replaceAll(tables: BackupTables): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Cleared in reverse, so a table is never emptied before something that
      // reads alongside it. There are no foreign keys, but the order keeps
      // the intent obvious to whoever reads this next.
      for (const name of [...BACKUP_TABLES].reverse()) {
        await tx.run(sql.raw(`DELETE FROM ${name}`));
      }

      for (const name of BACKUP_TABLES) {
        for (const row of tables[name] ?? []) {
          await tx.run(insertFor(name, row));
        }
      }
    });
  }
}

/**
 * Built from the row's own keys, so a backup taken by a later version — with
 * a column this build has never heard of — fails loudly on the insert rather
 * than dropping the column on the floor.
 */
function insertFor(table: string, row: BackupRow) {
  const columns = Object.keys(row);
  const placeholders = columns.map(() => '?').join(', ');
  const statement = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  return sql.raw(bind(statement, columns.map((c) => row[c])));
}

/**
 * Values are inlined rather than bound, because `sql.raw` takes no parameters
 * and the alternative is building a tagged template per column count. Every
 * value is a string, a number or null out of JSON, and strings are quoted by
 * doubling any quote they contain, which is SQLite's own escape.
 */
function bind(statement: string, values: readonly (string | number | null)[]): string {
  let index = 0;
  return statement.replace(/\?/g, () => literal(values[index++]));
}

function literal(value: string | number | null): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}
