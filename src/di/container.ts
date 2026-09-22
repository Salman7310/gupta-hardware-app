import { Id } from '../core';
import { Clock, ProductRepository, systemClock } from '../services/ports';
import { db } from '../data/db/client';
import { DrizzleProductRepository } from '../data/repositories/product.repository';

/**
 * The composition root: the one place that knows which concrete adapter
 * implements which port. Nothing else in the app imports from src/data.
 */
export interface AppContainer {
  readonly shopId: Id;
  readonly deviceId: string;
  readonly clock: Clock;
  readonly productRepository: ProductRepository;
}

export interface ContainerOptions {
  readonly shopId: Id;
  readonly deviceId: string;
  readonly clock?: Clock;
}

export function createContainer({
  shopId,
  deviceId,
  clock = systemClock,
}: ContainerOptions): AppContainer {
  return {
    shopId,
    deviceId,
    clock,
    productRepository: new DrizzleProductRepository(db, shopId, deviceId),
  };
}
