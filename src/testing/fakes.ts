import { Id } from '../core';
import { Customer } from '../models/customer';
import { Invoice } from '../models/invoice';
import { Product } from '../models/product';
import { StockMovement } from '../models/stock-movement';
import {
  Clock,
  CustomerRepository,
  IdGenerator,
  InvoiceRepository,
  ProductRepository,
  SecureKeyStore,
  SettingsRepository,
  StockMovementRepository,
} from '../services/ports';

/**
 * In-memory implementations of every port.
 *
 * These are fakes, not mocks: they behave like the real thing, so a test that
 * passes against them is testing behaviour rather than call order. No test
 * needs a device or a database.
 */

const matches = (haystack: string, needle: string): boolean =>
  haystack.toLowerCase().includes(needle.trim().toLowerCase());

export class InMemoryProductRepository implements ProductRepository {
  constructor(private items: Product[] = []) {}

  async list(): Promise<Product[]> {
    return [...this.items].sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(id: Id): Promise<Product | null> {
    return this.items.find((p) => p.id === id) ?? null;
  }

  async search(term: string): Promise<Product[]> {
    return (await this.list()).filter((p) => matches(p.name, term));
  }

  async save(product: Product): Promise<void> {
    const index = this.items.findIndex((p) => p.id === product.id);
    if (index >= 0) this.items[index] = product;
    else this.items.push(product);
  }
}

export class InMemoryCustomerRepository implements CustomerRepository {
  constructor(private items: Customer[] = []) {}

  async list(): Promise<Customer[]> {
    return [...this.items].sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(id: Id): Promise<Customer | null> {
    return this.items.find((c) => c.id === id) ?? null;
  }

  async search(term: string): Promise<Customer[]> {
    return (await this.list()).filter((c) => matches(c.name, term) || matches(c.phone ?? '', term));
  }

  async save(customer: Customer): Promise<void> {
    const index = this.items.findIndex((c) => c.id === customer.id);
    if (index >= 0) this.items[index] = customer;
    else this.items.push(customer);
  }
}

export class InMemoryStockMovementRepository implements StockMovementRepository {
  constructor(public movements: StockMovement[] = []) {}

  async listForProduct(productId: Id): Promise<StockMovement[]> {
    return this.movements.filter((m) => m.productId === productId);
  }

  async stockFor(productId: Id): Promise<number> {
    return (await this.listForProduct(productId)).reduce((t, m) => t + m.quantity.amount, 0);
  }

  async append(movement: StockMovement): Promise<void> {
    this.movements.push(movement);
  }
}

export class InMemoryInvoiceRepository implements InvoiceRepository {
  constructor(
    public invoices: Invoice[] = [],
    private readonly stock = new InMemoryStockMovementRepository(),
  ) {}

  async findById(id: Id): Promise<Invoice | null> {
    return this.invoices.find((i) => i.id === id) ?? null;
  }

  async listRecent(limit: number): Promise<Invoice[]> {
    return [...this.invoices].sort((a, b) => b.issuedAt - a.issuedAt).slice(0, limit);
  }

  async create(invoice: Invoice, movements: readonly StockMovement[]): Promise<void> {
    if (this.invoices.some((i) => i.invoiceNo === invoice.invoiceNo)) {
      throw new Error(`duplicate invoice number ${invoice.invoiceNo}`);
    }
    this.invoices.push(invoice);
    for (const movement of movements) await this.stock.append(movement);
  }
}

export class InMemorySettingsRepository implements SettingsRepository {
  constructor(private readonly values: Map<string, string> = new Map()) {}

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async setMany(entries: Readonly<Record<string, string>>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) this.values.set(key, value);
  }

  async increment(key: string): Promise<number> {
    const next = Number(this.values.get(key) ?? '0') + 1;
    this.values.set(key, String(next));
    return next;
  }
}

export class InMemorySecureKeyStore implements SecureKeyStore {
  constructor(private readonly values: Map<string, string> = new Map()) {}

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

/** Deterministic ids so assertions can name them. */
export class SequentialIdGenerator implements IdGenerator {
  private count = 0;
  constructor(private readonly prefix = 'id') {}

  next(): Id {
    this.count += 1;
    return `${this.prefix}-${this.count}`;
  }
}

export const fixedClock = (at: number): Clock => ({ now: () => at });
