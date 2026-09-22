import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * Every table carries shopId, deviceId, updatedAt and deletedAt from day one.
 *
 * These cost one column each today and are a painful migration once the shop
 * has thousands of real bills. They are what makes multi-device sync and a
 * second shop possible later without reshaping the database. Rows are never
 * hard deleted, because a deleted row cannot sync: the other device has no
 * idea it existed and would recreate it.
 */
const syncColumns = {
  shopId: text('shop_id').notNull(),
  deviceId: text('device_id').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
};

export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    unitCode: text('unit_code').notNull(),
    salePricePaise: integer('sale_price_paise').notNull(),
    purchasePricePaise: integer('purchase_price_paise').notNull().default(0),
    taxRateBps: integer('tax_rate_bps').notNull().default(0),
    hsnCode: text('hsn_code'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...syncColumns,
  },
  (t) => [index('products_shop_name_idx').on(t.shopId, t.name)],
);

export const customers = sqliteTable(
  'customers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone'),
    address: text('address'),
    gstin: text('gstin'),
    ...syncColumns,
  },
  (t) => [index('customers_shop_name_idx').on(t.shopId, t.name)],
);

export const invoices = sqliteTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    /** Per-device series, e.g. GH/A/0048, so two offline counters cannot clash. */
    invoiceNo: text('invoice_no').notNull(),
    customerId: text('customer_id'),
    issuedAt: integer('issued_at').notNull(),
    subtotalPaise: integer('subtotal_paise').notNull(),
    discountPaise: integer('discount_paise').notNull().default(0),
    taxablePaise: integer('taxable_paise').notNull(),
    cgstPaise: integer('cgst_paise').notNull().default(0),
    sgstPaise: integer('sgst_paise').notNull().default(0),
    roundOffPaise: integer('round_off_paise').notNull().default(0),
    grandTotalPaise: integer('grand_total_paise').notNull(),
    paidPaise: integer('paid_paise').notNull().default(0),
    notes: text('notes'),
    ...syncColumns,
  },
  (t) => [index('invoices_shop_issued_idx').on(t.shopId, t.issuedAt)],
);

export const invoiceItems = sqliteTable(
  'invoice_items',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id').notNull(),
    productId: text('product_id'),
    /** Snapshots. A price change next month must not rewrite an old bill. */
    nameSnapshot: text('name_snapshot').notNull(),
    ratePaise: integer('rate_paise').notNull(),
    taxRateBps: integer('tax_rate_bps').notNull().default(0),
    discountBps: integer('discount_bps').notNull().default(0),
    /** Whole sub-units: square inches, millilitres, boxes, bags. Never a decimal. */
    quantityAmount: integer('quantity_amount').notNull(),
    unitCode: text('unit_code').notNull(),
    /** The measurement working printed under a marble line, as JSON. */
    dimensionsJson: text('dimensions_json'),
    linePaise: integer('line_paise').notNull(),
    ...syncColumns,
  },
  (t) => [index('invoice_items_invoice_idx').on(t.invoiceId)],
);

/**
 * Stock is a ledger, never a mutable counter. Two counters selling offline
 * would overwrite each other's arithmetic and the count would drift with no
 * way to find where. Inserts never conflict, so summing movements is both
 * correct under sync and better bookkeeping.
 */
export const stockMovements = sqliteTable(
  'stock_movements',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull(),
    kind: text('kind').notNull(),
    /** Signed: negative for a sale, positive for a purchase. */
    quantityAmount: integer('quantity_amount').notNull(),
    unitCode: text('unit_code').notNull(),
    refInvoiceId: text('ref_invoice_id'),
    occurredAt: integer('occurred_at').notNull(),
    note: text('note'),
    ...syncColumns,
  },
  (t) => [index('stock_movements_product_idx').on(t.productId, t.occurredAt)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  ...syncColumns,
});
