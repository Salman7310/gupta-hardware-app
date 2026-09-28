import { AmendInvoice } from '../services/amend-invoice';
import { BackupService } from '../services/backup-service';
import { BillArchive } from '../services/bill-archive';
import { CreateInvoice } from '../services/create-invoice';
import { CreateQuotation } from '../services/create-quotation';
import { QuotationArchive } from '../services/quotation-archive';
import { QuotationBook } from '../services/quotation-book';
import { QuotationNumberService } from '../services/quotation-number';
import { CustomerBook } from '../services/customer';
import { Identity } from '../services/identity';
import { PaymentBook } from '../services/payment';
import { InvoiceNumberService } from '../services/invoice-number';
import { ProductCatalogue } from '../services/product-catalogue';
import {
  BackupRepository,
  CustomerRepository,
  InvoiceRepository,
  PaymentRepository,
  ProductRepository,
  QuotationRepository,
  StockMovementRepository,
} from '../services/ports';
import { DrizzleBackupRepository } from '../data/repositories/backup.repository';
import { ExpoBackupFiler } from '../data/backup-filer';
import { DrizzleCustomerRepository } from '../data/repositories/customer.repository';
import { DrizzleInvoiceRepository } from '../data/repositories/invoice.repository';
import { DrizzlePaymentRepository } from '../data/repositories/payment.repository';
import { DrizzleQuotationRepository } from '../data/repositories/quotation.repository';
import { ExpoDocumentFiler } from '../data/document-filer';
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
  /**
   * Re-reads the shop and device after the owner edits their details.
   *
   * The container captures the shop by value — the archives print its name on
   * every document — so an edit has to rebuild the container rather than
   * mutate it in place. Supplied by whatever built the container.
   */
  readonly reloadIdentity: () => Promise<void>;
  readonly productRepository: ProductRepository;
  readonly customerRepository: CustomerRepository;
  readonly invoiceRepository: InvoiceRepository;
  readonly paymentRepository: PaymentRepository;
  readonly stockRepository: StockMovementRepository;
  readonly quotationRepository: QuotationRepository;
  readonly backupRepository: BackupRepository;
  readonly invoiceNumbers: InvoiceNumberService;
  readonly quotationNumbers: QuotationNumberService;
  readonly createInvoice: CreateInvoice;
  readonly amendInvoice: AmendInvoice;
  readonly createQuotation: CreateQuotation;
  readonly catalogue: ProductCatalogue;
  readonly customers: CustomerBook;
  readonly paymentBook: PaymentBook;
  readonly billArchive: BillArchive;
  readonly quotations: QuotationBook;
  readonly quotationArchive: QuotationArchive;
  readonly backups: BackupService;
}

export function createContainer(
  runtime: AppRuntime,
  identity: Identity,
  reloadIdentity: () => Promise<void>,
): AppContainer {
  const { db, platform } = runtime;
  const shopId = identity.shop.id;
  const deviceId = identity.device.id;

  const productRepository = new DrizzleProductRepository(db, shopId, deviceId);
  const stockRepository = new DrizzleStockMovementRepository(db, shopId, deviceId);
  const invoiceRepository = new DrizzleInvoiceRepository(db, shopId, deviceId);
  const customerRepository = new DrizzleCustomerRepository(db, shopId, deviceId);
  const paymentRepository = new DrizzlePaymentRepository(db, shopId, deviceId);
  const quotationRepository = new DrizzleQuotationRepository(db, shopId, deviceId);
  const backupRepository = new DrizzleBackupRepository(db);
  const invoiceNumbers = new InvoiceNumberService(platform.settings);
  const quotationNumbers = new QuotationNumberService(platform.settings);
  // One filer for both documents: the shop nominates a single folder and both
  // bills and quotations are rendered by the same print engine.
  const filer = new ExpoDocumentFiler(platform.settings);

  return {
    ...platform,
    identity,
    reloadIdentity,
    productRepository,
    stockRepository,
    customerRepository,
    invoiceRepository,
    paymentRepository,
    quotationRepository,
    backupRepository,
    invoiceNumbers,
    quotationNumbers,
    createInvoice: new CreateInvoice(
      invoiceRepository,
      invoiceNumbers,
      platform.ids,
      platform.clock,
      identity,
    ),
    amendInvoice: new AmendInvoice(invoiceRepository, platform.ids, platform.clock, identity),
    createQuotation: new CreateQuotation(
      quotationRepository,
      quotationNumbers,
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
    customers: new CustomerBook(customerRepository, platform.ids, platform.clock, shopId),
    paymentBook: new PaymentBook(paymentRepository, platform.ids, platform.clock, shopId),
    billArchive: new BillArchive(filer, identity.shop),
    quotations: new QuotationBook(quotationRepository, platform.clock),
    quotationArchive: new QuotationArchive(filer, identity.shop, platform.clock),
    backups: new BackupService(
      backupRepository,
      new ExpoBackupFiler(platform.settings),
      platform.clock,
      identity.shop,
      platform.settings,
    ),
  };
}
