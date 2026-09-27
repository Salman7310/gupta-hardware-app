// Type-only, so building a test container never loads the data layer.
import type { AppContainer } from '../di/container';
import { BackupService } from '../services/backup-service';
import { BillArchive } from '../services/bill-archive';
import { CreateInvoice } from '../services/create-invoice';
import { CreateQuotation } from '../services/create-quotation';
import { QuotationArchive } from '../services/quotation-archive';
import { QuotationBook } from '../services/quotation-book';
import { QuotationNumberService } from '../services/quotation-number';
import { CustomerBook } from '../services/customer';
import { IdentityService } from '../services/identity';
import { InvoiceNumberService } from '../services/invoice-number';
import { PaymentBook } from '../services/payment';
import { ProductCatalogue } from '../services/product-catalogue';
import {
  fixedClock,
  InMemoryDocumentFiler,
  InMemoryBackupFiler,
  InMemoryBackupRepository,
  InMemoryCustomerRepository,
  InMemoryInvoiceRepository,
  InMemoryPaymentRepository,
  InMemoryProductRepository,
  InMemoryQuotationRepository,
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
  // Hand the shared ledgers to the invoice repository, so a sale written
  // through it is visible to anything reading stock, and an opening payment is
  // visible to anything reading what the bill still owes.
  const paymentRepository = new InMemoryPaymentRepository();
  const invoiceRepository = new InMemoryInvoiceRepository([], stockRepository, paymentRepository);
  const invoiceNumbers = new InvoiceNumberService(settings);
  const quotationRepository = new InMemoryQuotationRepository();
  const backupRepository = new InMemoryBackupRepository();
  const quotationNumbers = new QuotationNumberService(settings);
  const filer = new InMemoryDocumentFiler();
  const customerRepository = new InMemoryCustomerRepository();
  const identity = {
    shop: {
      id: 'shop-1',
      name: 'Gupta Hardware',
      address: null,
      phone: null,
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
    reloadIdentity: async () => undefined,
    productRepository,
    stockRepository,
    customerRepository,
    invoiceRepository,
    paymentRepository,
    quotationRepository,
    backupRepository,
    invoiceNumbers,
    quotationNumbers,
    createInvoice: new CreateInvoice(invoiceRepository, invoiceNumbers, ids, clock, identity),
    createQuotation: new CreateQuotation(
      quotationRepository,
      quotationNumbers,
      ids,
      clock,
      identity,
    ),
    catalogue: new ProductCatalogue(productRepository, stockRepository, ids, clock, 'shop-1'),
    customers: new CustomerBook(customerRepository, ids, clock, 'shop-1'),
    paymentBook: new PaymentBook(paymentRepository, ids, clock, 'shop-1'),
    billArchive: new BillArchive(filer, identity.shop),
    quotations: new QuotationBook(quotationRepository, clock),
    quotationArchive: new QuotationArchive(filer, identity.shop, clock),
    backups: new BackupService(
      backupRepository,
      new InMemoryBackupFiler(),
      clock,
      identity.shop,
      settings,
    ),
    ...overrides,
  };
}
