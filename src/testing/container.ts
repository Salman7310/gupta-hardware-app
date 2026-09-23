// Type-only, so building a test container never loads the data layer.
import type { AppContainer } from '../di/container';
import { CreateInvoice } from '../services/create-invoice';
import { CustomerBook } from '../services/customer';
import { IdentityService } from '../services/identity';
import { InvoiceNumberService } from '../services/invoice-number';
import { ProductCatalogue } from '../services/product-catalogue';
import {
  fixedClock,
  InMemoryCustomerRepository,
  InMemoryInvoiceRepository,
  InMemoryProductRepository,
  InMemorySecureKeyStore,
  InMemorySettingsRepository,
  InMemoryStockMovementRepository,
  SequentialIdGenerator,
} from './fakes';

export function makeTestContainer(overrides: Partial<AppContainer> = {}): AppContainer {
  const settings = new InMemorySettingsRepository();
  const secure = new InMemorySecureKeyStore();
  const ids = new SequentialIdGenerator();
  const clock = fixedClock(1_700_000_000_000);
  const productRepository = new InMemoryProductRepository();
  const stockRepository = new InMemoryStockMovementRepository();
  // Hand the shared ledger to the invoice repository, so a sale written
  // through it is visible to anything reading stock.
  const invoiceRepository = new InMemoryInvoiceRepository([], stockRepository);
  const invoiceNumbers = new InvoiceNumberService(settings);
  const customerRepository = new InMemoryCustomerRepository();
  const identity = {
    shop: {
      id: 'shop-1',
      name: 'Gupta Hardware',
      address: null,
      gstin: null,
      invoicePrefix: 'GH',
    },
    device: { id: 'device-1', letter: 'A' },
  };

  return {
    settings,
    secure,
    ids,
    clock,
    identityService: new IdentityService(settings, secure, ids),
    identity,
    productRepository,
    stockRepository,
    customerRepository,
    invoiceRepository,
    invoiceNumbers,
    createInvoice: new CreateInvoice(invoiceRepository, invoiceNumbers, ids, clock, identity),
    catalogue: new ProductCatalogue(productRepository, stockRepository, ids, clock, 'shop-1'),
    customers: new CustomerBook(customerRepository, ids, clock, 'shop-1'),
    ...overrides,
  };
}
