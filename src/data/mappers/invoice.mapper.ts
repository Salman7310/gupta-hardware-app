import { Dimension, Money, Quantity, UnitCode } from '../../core';
import { Invoice, InvoiceItem } from '../../models/invoice';
import { invoiceItems, invoices } from '../db/schema';

type InvoiceRow = typeof invoices.$inferSelect;
type InvoiceInsert = typeof invoices.$inferInsert;
type ItemRow = typeof invoiceItems.$inferSelect;
type ItemInsert = typeof invoiceItems.$inferInsert;

function parseDimensions(json: string | null): readonly Dimension[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Dimension[]) : [];
  } catch {
    // A corrupt working note must not make the bill unreadable; the stored
    // quantity is authoritative and is kept either way.
    return [];
  }
}

export function toInvoiceItem(row: ItemRow): InvoiceItem {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    productId: row.productId,
    name: row.nameSnapshot,
    quantity: Quantity.restore(
      row.quantityAmount,
      row.unitCode as UnitCode,
      parseDimensions(row.dimensionsJson),
    ),
    rate: Money.fromPaise(row.ratePaise),
    taxRateBps: row.taxRateBps,
    discountBps: row.discountBps,
    discount: Money.fromPaise(row.discountPaise),
    lineTotal: Money.fromPaise(row.linePaise),
    hsnCode: row.hsnCode,
  };
}

/**
 * `paidPaise` is passed in rather than read off the row: what has been paid is
 * the sum of the bill's receipts in the payments ledger, and the column on the
 * invoice is a legacy of the version before that ledger existed.
 */
export function toInvoice(
  row: InvoiceRow,
  items: readonly ItemRow[],
  paidPaise: number,
): Invoice {
  return {
    id: row.id,
    shopId: row.shopId,
    invoiceNo: row.invoiceNo,
    customerId: row.customerId,
    issuedAt: row.issuedAt,
    subtotal: Money.fromPaise(row.subtotalPaise),
    discount: Money.fromPaise(row.discountPaise),
    billDiscount: Money.fromPaise(row.billDiscountPaise),
    taxable: Money.fromPaise(row.taxablePaise),
    cgst: Money.fromPaise(row.cgstPaise),
    sgst: Money.fromPaise(row.sgstPaise),
    roundOff: Money.fromPaise(row.roundOffPaise),
    grandTotal: Money.fromPaise(row.grandTotalPaise),
    paid: Money.fromPaise(paidPaise),
    notes: row.notes,
    amendedAt: row.amendedAt,
    cancelledAt: row.cancelledAt,
    items: items.map(toInvoiceItem),
  };
}

export function toInvoiceRow(invoice: Invoice, deviceId: string): InvoiceInsert {
  return {
    id: invoice.id,
    shopId: invoice.shopId,
    invoiceNo: invoice.invoiceNo,
    customerId: invoice.customerId,
    issuedAt: invoice.issuedAt,
    subtotalPaise: invoice.subtotal.paise,
    discountPaise: invoice.discount.paise,
    billDiscountPaise: invoice.billDiscount.paise,
    taxablePaise: invoice.taxable.paise,
    cgstPaise: invoice.cgst.paise,
    sgstPaise: invoice.sgst.paise,
    roundOffPaise: invoice.roundOff.paise,
    grandTotalPaise: invoice.grandTotal.paise,
    // Deliberately not written: the payments ledger owns what has been paid.
    notes: invoice.notes,
    amendedAt: invoice.amendedAt,
    cancelledAt: invoice.cancelledAt,
    deviceId,
    updatedAt: invoice.issuedAt,
    deletedAt: null,
  };
}

export function toInvoiceItemRow(item: InvoiceItem, shopId: string, deviceId: string): ItemInsert {
  const working = item.quantity.dimensions;
  return {
    id: item.id,
    invoiceId: item.invoiceId,
    productId: item.productId,
    nameSnapshot: item.name,
    ratePaise: item.rate.paise,
    taxRateBps: item.taxRateBps,
    discountBps: item.discountBps,
    discountPaise: item.discount.paise,
    quantityAmount: item.quantity.amount,
    unitCode: item.quantity.unit.code,
    dimensionsJson: working.length > 0 ? JSON.stringify(working) : null,
    linePaise: item.lineTotal.paise,
    hsnCode: item.hsnCode,
    shopId,
    deviceId,
    updatedAt: Date.now(),
    deletedAt: null,
  };
}
