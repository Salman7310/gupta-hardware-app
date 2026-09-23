import { CreateInvoice } from '../services/create-invoice';
import { Identity } from '../services/identity';
import { InvoiceNumberService } from '../services/invoice-number';
import { ProductCatalogue } from '../services/product-catalogue';
import {
  CustomerRepository,
  InvoiceRepository,
  ProductRepository,
  StockMovementRepository,
} from '../services/ports';
import { DrizzleCustomerRepository } from '../data/repositories/customer.repository';
import { DrizzleInvoiceRepository } from '../data/repositories/invoice.repository';
import { DrizzleProductRepository } from '../data/repositories/product.repository';
import { DrizzleStockMovementRepository } from '../data/repositories/stock-movement.repository';
import type { AppRuntime } from './bootstrap';
import type { PlatformServices } from './platform';

/**
 * The composition root: the one place that knows which concrete adapter
 * implements which port. The database handle stays in AppRuntime and is
 * deliberately not part of this type, so no screen can reach past a repository.
 */
export interface AppContainer extends PlatformServices {
  readonly identity: Identity;
  readonly productRepository: ProductRepository;
  readonly customerRepository: CustomerRepository;
  readonly invoiceRepository: InvoiceRepository;
  readonly stockRepository: StockMovementRepository;
  readonly invoiceNumbers: InvoiceNumberService;
  readonly createInvoice: CreateInvoice;
  readonly catalogue: ProductCatalogue;
}

export function createContainer(runtime: AppRuntime, identity: Identity): AppContainer {
  const { db, platform } = runtime;
  const shopId = identity.shop.id;
  const deviceId = identity.device.id;

  const productRepository = new DrizzleProductRepository(db, shopId, deviceId);
  const stockRepository = new DrizzleStockMovementRepository(db, shopId, deviceId);
  const invoiceRepository = new DrizzleInvoiceRepository(db, shopId, deviceId);
  const invoiceNumbers = new InvoiceNumberService(platform.settings);

  return {
    ...platform,
    identity,
    productRepository,
    stockRepository,
    customerRepository: new DrizzleCustomerRepository(db, shopId, deviceId),
    invoiceRepository,
    invoiceNumbers,
    createInvoice: new CreateInvoice(
      invoiceRepository,
      invoiceNumbers,
      platform.ids,
      platform.clock,
      identity,
    ),
    catalogue: new ProductCatalogue(
      productRepository,
      stockRepository,
      platform.ids,
      platform.clock,
      shopId,
    ),
  };
}
