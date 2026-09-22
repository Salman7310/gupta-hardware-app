import { Id } from '../core';
import { Product } from '../models/product';
import { Customer } from '../models/customer';
import { Invoice } from '../models/invoice';
import { StockMovement } from '../models/stock-movement';

/**
 * Ports.
 *
 * Everything above the data layer depends on these interfaces, never on
 * Drizzle or expo-sqlite, so storage can be replaced without touching business
 * logic and every one of them has an in-memory fake in src/testing.
 */

export interface ProductRepository {
  list(): Promise<Product[]>;
  findById(id: Id): Promise<Product | null>;
  search(term: string): Promise<Product[]>;
  save(product: Product): Promise<void>;
}

export interface CustomerRepository {
  list(): Promise<Customer[]>;
  findById(id: Id): Promise<Customer | null>;
  search(term: string): Promise<Customer[]>;
  save(customer: Customer): Promise<void>;
}

export interface InvoiceRepository {
  findById(id: Id): Promise<Invoice | null>;
  listRecent(limit: number): Promise<Invoice[]>;
  /**
   * Writes the invoice, its lines and the resulting stock movements as one
   * unit. A bill that reduced stock but failed to save, or vice versa, is
   * worse than a bill that failed outright.
   */
  create(invoice: Invoice, movements: readonly StockMovement[]): Promise<void>;
}

export interface StockMovementRepository {
  listForProduct(productId: Id): Promise<StockMovement[]>;
  /** Current stock in the unit's sub-units, summed from the ledger. */
  stockFor(productId: Id): Promise<number>;
  append(movement: StockMovement): Promise<void>;
}

export interface SettingsRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setMany(entries: Readonly<Record<string, string>>): Promise<void>;
  /**
   * Atomically increments a counter and returns the new value. Used for the
   * invoice series, where two taps must never produce the same number.
   */
  increment(key: string): Promise<number>;
}

/** Device-bound secret storage, backed by the Android Keystore. */
export interface SecureKeyStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface IdGenerator {
  next(): Id;
}

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };
