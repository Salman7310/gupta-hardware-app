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
    piecesPerBox: integer('pieces_per_box'),
    boxCoverageSqIn: integer('box_coverage_sq_in'),
    minStock: integer('min_stock'),
    barcode: text('barcode'),
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
    /** The lump sum alone, so a bill can print it on its own row. */
    billDiscountPaise: integer('bill_discount_paise').notNull().default(0),
    taxablePaise: integer('taxable_paise').notNull(),
    cgstPaise: integer('cgst_paise').notNull().default(0),
    sgstPaise: integer('sgst_paise').notNull().default(0),
    roundOffPaise: integer('round_off_paise').notNull().default(0),
    grandTotalPaise: integer('grand_total_paise').notNull(),
    /**
     * Superseded by the payments ledger and no longer read. Kept so the
     * migration that introduced `payments` could backfill from it, and so an
     * older build that still reads it is not left with a null column.
     */
    paidPaise: integer('paid_paise').notNull().default(0),
    notes: text('notes'),
    /** Set when items were added to a bill that had already been issued. */
    amendedAt: integer('amended_at'),
    /**
     * Set when the bill was cancelled. The row is never removed and never
     * gets a `deletedAt`: a tax invoice number has to stay in the series, so
     * a cancelled bill keeps its place in the book and shows as cancelled.
     */
    cancelledAt: integer('cancelled_at'),
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
    /**
     * What came off this line in rupees, including its share of a bill-level
     * lump sum. A share rarely lands on a whole basis point, so the rate alone
     * cannot reproduce the paise.
     */
    discountPaise: integer('discount_paise').notNull().default(0),
    /** Whole sub-units: square inches, millilitres, boxes, bags. Never a decimal. */
    quantityAmount: integer('quantity_amount').notNull(),
    unitCode: text('unit_code').notNull(),
    /** The measurement working printed under a marble line, as JSON. */
    dimensionsJson: text('dimensions_json'),
    linePaise: integer('line_paise').notNull(),
    /** The product's HSN code at the time of sale; null for older rows. */
    hsnCode: text('hsn_code'),
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

/**
 * Money received against a bill, as a ledger rather than a running total on
 * the invoice row, for the same reason stock is a ledger. A part payment is a
 * new fact, not an edit: appending never conflicts under sync, whereas two
 * counters each rewriting `paid` would lose one of the receipts silently. What
 * is owed is the bill less the sum of these rows.
 */
export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id').notNull(),
    amountPaise: integer('amount_paise').notNull(),
    /** cash, upi, card, bank or other. */
    method: text('method').notNull(),
    receivedAt: integer('received_at').notNull(),
    note: text('note'),
    ...syncColumns,
  },
  (t) => [index('payments_invoice_idx').on(t.invoiceId, t.receivedAt)],
);

/**
 * Estimates given across the counter, before anything is sold.
 *
 * A separate pair of tables rather than a flag on `invoices`, because a
 * quotation is a different thing with different rules: it takes no number from
 * the invoice series, moves no stock, is owed by nobody and must never be
 * swept up by a query for what a customer owes. One table with a mode column
 * would make every one of those queries a place to forget the filter.
 */
export const quotations = sqliteTable(
  'quotations',
  {
    id: text('id').primaryKey(),
    /** Its own per-device series, e.g. GH/QA/0007. */
    quotationNo: text('quotation_no').notNull(),
    customerId: text('customer_id'),
    issuedAt: integer('issued_at').notNull(),
    /** When the prices stop standing. Expiry is derived from this, never stored. */
    validUntil: integer('valid_until').notNull(),
    subtotalPaise: integer('subtotal_paise').notNull(),
    discountPaise: integer('discount_paise').notNull().default(0),
    billDiscountPaise: integer('bill_discount_paise').notNull().default(0),
    taxablePaise: integer('taxable_paise').notNull(),
    cgstPaise: integer('cgst_paise').notNull().default(0),
    sgstPaise: integer('sgst_paise').notNull().default(0),
    roundOffPaise: integer('round_off_paise').notNull().default(0),
    grandTotalPaise: integer('grand_total_paise').notNull(),
    /** The bill this became, once the customer accepted it. */
    acceptedInvoiceId: text('accepted_invoice_id'),
    notes: text('notes'),
    ...syncColumns,
  },
  (t) => [index('quotations_shop_issued_idx').on(t.shopId, t.issuedAt)],
);

export const quotationItems = sqliteTable(
  'quotation_items',
  {
    id: text('id').primaryKey(),
    quotationId: text('quotation_id').notNull(),
    productId: text('product_id'),
    /** Snapshots, as on a bill: the price quoted is the price honoured. */
    nameSnapshot: text('name_snapshot').notNull(),
    ratePaise: integer('rate_paise').notNull(),
    taxRateBps: integer('tax_rate_bps').notNull().default(0),
    discountBps: integer('discount_bps').notNull().default(0),
    discountPaise: integer('discount_paise').notNull().default(0),
    quantityAmount: integer('quantity_amount').notNull(),
    unitCode: text('unit_code').notNull(),
    dimensionsJson: text('dimensions_json'),
    linePaise: integer('line_paise').notNull(),
    /** The product's HSN code at the time of sale; null for older rows. */
    hsnCode: text('hsn_code'),
    ...syncColumns,
  },
  (t) => [index('quotation_items_quotation_idx').on(t.quotationId)],
);

/**
 * Device-local configuration. Unlike every other table, shopId is nullable:
 * the shop id is itself stored here during first-run setup, so the row that
 * establishes the shop necessarily precedes it.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  shopId: text('shop_id'),
  deviceId: text('device_id'),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});
