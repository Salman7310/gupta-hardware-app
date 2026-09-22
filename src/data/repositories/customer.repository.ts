import { and, eq, isNull, like, or } from 'drizzle-orm';
import { Id } from '../../core';
import { Customer } from '../../models/customer';
import { CustomerRepository } from '../../services/ports';
import { Database } from '../db/client';
import { customers } from '../db/schema';
import { toCustomer, toCustomerRow } from '../mappers/customer.mapper';

export class DrizzleCustomerRepository implements CustomerRepository {
  constructor(
    private readonly db: Database,
    private readonly shopId: Id,
    private readonly deviceId: string,
  ) {}

  private get scope() {
    return and(eq(customers.shopId, this.shopId), isNull(customers.deletedAt));
  }

  async list(): Promise<Customer[]> {
    const rows = await this.db.select().from(customers).where(this.scope).orderBy(customers.name);
    return rows.map(toCustomer);
  }

  async findById(id: Id): Promise<Customer | null> {
    const rows = await this.db
      .select()
      .from(customers)
      .where(and(this.scope, eq(customers.id, id)))
      .limit(1);
    return rows.length > 0 ? toCustomer(rows[0]) : null;
  }

  async search(term: string): Promise<Customer[]> {
    const pattern = `%${term}%`;
    const rows = await this.db
      .select()
      .from(customers)
      .where(and(this.scope, or(like(customers.name, pattern), like(customers.phone, pattern))))
      .orderBy(customers.name)
      .limit(50);
    return rows.map(toCustomer);
  }

  async save(customer: Customer): Promise<void> {
    const row = toCustomerRow(customer, this.deviceId);
    await this.db
      .insert(customers)
      .values(row)
      .onConflictDoUpdate({ target: customers.id, set: row });
  }
}
