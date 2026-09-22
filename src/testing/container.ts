// Type-only, so building a test container never loads the data layer.
import type { AppContainer } from '../di/container';
import { IdentityService } from '../services/identity';
import { InvoiceNumberService } from '../services/invoice-number';
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

  return {
    settings,
    secure,
    ids,
    clock: fixedClock(1_700_000_000_000),
    identityService: new IdentityService(settings, secure, ids),
    identity: {
      shop: {
        id: 'shop-1',
        name: 'Gupta Hardware',
        address: null,
        gstin: null,
        invoicePrefix: 'GH',
      },
      device: { id: 'device-1', letter: 'A' },
    },
    productRepository: new InMemoryProductRepository(),
    customerRepository: new InMemoryCustomerRepository(),
    invoiceRepository: new InMemoryInvoiceRepository(),
    stockRepository: new InMemoryStockMovementRepository(),
    invoiceNumbers: new InvoiceNumberService(settings),
    ...overrides,
  };
}
