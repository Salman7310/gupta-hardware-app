import { Money, Quantity, UnitCode } from '../core';
import { Customer } from '../models/customer';
import { Invoice, InvoiceItem } from '../models/invoice';
import { Payment, PaymentMethod } from '../models/payment';
import { Product, ProductCategory } from '../models/product';
import { DAY_MS, Quotation, QuotationItem } from '../models/quotation';
import { Shop } from '../models/shop';
import { MovementKind, StockMovement } from '../models/stock-movement';

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`;

export function aProduct(over: Partial<Product> = {}): Product {
  return {
    id: nextId('product'),
    shopId: 'shop-1',
    name: 'Vitrified tile 2x2',
    category: 'tiles' as ProductCategory,
    unitCode: 'box' as UnitCode,
    salePrice: Money.fromRupees(450),
    purchasePrice: Money.fromRupees(380),
    taxRateBps: 1800,
    hsnCode: null,
    isActive: true,
    updatedAt: 0,
    piecesPerBox: null,
    boxCoverageSqIn: null,
    minStock: null,
    barcode: null,
    ...over,
  };
}

export function aStockMovement(over: Partial<StockMovement> = {}): StockMovement {
  return {
    id: nextId('movement'),
    shopId: 'shop-1',
    productId: 'product-1',
    kind: 'purchase' as MovementKind,
    quantity: Quantity.of(10, 'box'),
    refInvoiceId: null,
    occurredAt: 0,
    note: null,
    ...over,
  };
}

export function aCustomer(over: Partial<Customer> = {}): Customer {
  return {
    id: nextId('customer'),
    shopId: 'shop-1',
    name: 'Mahesh Kumar',
    phone: '9988776677',
    address: 'Shop 4, Main Bazaar Road\nRewari',
    gstin: '06ABCDE1234F1Z5',
    updatedAt: 0,
    ...over,
  };
}

export function aShop(over: Partial<Shop> = {}): Shop {
  return {
    id: 'shop-1',
    name: 'Gupta Hardware',
    address: 'Main Bazaar Road, Rewari',
    phone: '9812345678',
    gstin: '06AAAAA0000A1Z5',
    invoicePrefix: 'GH',
    ...over,
  };
}

export function anInvoiceItem(over: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    id: nextId('item'),
    invoiceId: 'invoice-1',
    productId: 'product-1',
    name: 'Berger Easy Clean Emulsion',
    quantity: Quantity.of(10000, 'litre'),
    rate: Money.fromRupees(385),
    taxRateBps: 1800,
    discountBps: 0,
    discount: Money.zero,
    lineTotal: Money.fromRupees(4315.85),
    hsnCode: '3209',
    ...over,
  };
}

export function anInvoice(over: Partial<Invoice> = {}): Invoice {
  return {
    id: nextId('invoice'),
    shopId: 'shop-1',
    invoiceNo: 'GH/A/0001',
    customerId: 'customer-1',
    issuedAt: 1_758_700_000_000,
    subtotal: Money.fromRupees(3850),
    discount: Money.fromRupees(192.5),
    billDiscount: Money.fromRupees(192.5),
    taxable: Money.fromRupees(3657.5),
    cgst: Money.fromRupees(329.18),
    sgst: Money.fromRupees(329.17),
    roundOff: Money.fromRupees(0.15),
    grandTotal: Money.fromRupees(4316),
    paid: Money.zero,
    notes: null,
    amendedAt: null,
    cancelledAt: null,
    items: [anInvoiceItem()],
    ...over,
  };
}

export function aPayment(over: Partial<Payment> = {}): Payment {
  return {
    id: nextId('payment'),
    shopId: 'shop-1',
    invoiceId: 'invoice-1',
    amount: Money.fromRupees(2000),
    method: 'cash' as PaymentMethod,
    receivedAt: 1_758_700_000_000,
    note: null,
    ...over,
  };
}

export function aQuotationItem(over: Partial<QuotationItem> = {}): QuotationItem {
  return {
    id: nextId('quote-item'),
    quotationId: 'quotation-1',
    productId: 'product-1',
    name: 'Berger Easy Clean Emulsion',
    quantity: Quantity.of(10000, 'litre'),
    rate: Money.fromRupees(385),
    taxRateBps: 1800,
    discountBps: 0,
    discount: Money.zero,
    lineTotal: Money.fromRupees(4315.85),
    hsnCode: '3209',
    ...over,
  };
}

export function aQuotation(over: Partial<Quotation> = {}): Quotation {
  const issuedAt = 1_758_700_000_000;
  return {
    id: nextId('quotation'),
    shopId: 'shop-1',
    quotationNo: 'GH/QA/0001',
    customerId: 'customer-1',
    issuedAt,
    validUntil: issuedAt + 7 * DAY_MS,
    subtotal: Money.fromRupees(3850),
    discount: Money.fromRupees(192.5),
    billDiscount: Money.fromRupees(192.5),
    taxable: Money.fromRupees(3657.5),
    cgst: Money.fromRupees(329.18),
    sgst: Money.fromRupees(329.17),
    roundOff: Money.fromRupees(0.15),
    grandTotal: Money.fromRupees(4316),
    acceptedInvoiceId: null,
    notes: null,
    items: [aQuotationItem()],
    ...over,
  };
}
