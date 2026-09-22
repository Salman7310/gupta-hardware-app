import { Id } from '../core';
import { Product } from '../models/product';

/**
 * Ports. The ViewModel layer depends on these interfaces, never on Drizzle or
 * expo-sqlite, so storage can be swapped without touching business logic.
 */
export interface ProductRepository {
  list(): Promise<Product[]>;
  findById(id: Id): Promise<Product | null>;
  search(term: string): Promise<Product[]>;
  save(product: Product): Promise<void>;
}

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };
