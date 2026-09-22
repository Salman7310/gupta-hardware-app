import { eq, sql } from 'drizzle-orm';
import { SettingsRepository } from '../../services/ports';
import { Database } from '../db/client';
import { settings } from '../db/schema';

export class DrizzleSettingsRepository implements SettingsRepository {
  constructor(private readonly db: Database) {}

  async get(key: string): Promise<string | null> {
    const rows = await this.db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return rows.length > 0 ? rows[0].value : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.setMany({ [key]: value });
  }

  async setMany(entries: Readonly<Record<string, string>>): Promise<void> {
    const now = Date.now();
    const rows = Object.entries(entries).map(([key, value]) => ({
      key,
      value,
      updatedAt: now,
      deletedAt: null,
    }));
    if (rows.length === 0) return;

    await this.db.transaction(async (tx) => {
      for (const row of rows) {
        await tx
          .insert(settings)
          .values(row)
          .onConflictDoUpdate({
            target: settings.key,
            set: { value: row.value, updatedAt: now },
          });
      }
    });
  }

  /**
   * Increments in a single statement so two concurrent callers cannot read the
   * same value and both write back the same next number. This is what stops
   * two fast taps producing the same invoice number.
   */
  async increment(key: string): Promise<number> {
    const now = Date.now();
    const rows = await this.db
      .insert(settings)
      .values({ key, value: '1', updatedAt: now, deletedAt: null })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: sql`cast(${settings.value} as integer) + 1`, updatedAt: now },
      })
      .returning({ value: settings.value });

    return rows.length > 0 ? Number(rows[0].value) : 1;
  }
}
