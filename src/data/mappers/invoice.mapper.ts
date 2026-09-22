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
    lineTotal: Money.fromPaise(row.linePaise),
  };
}

export function toInvoice(row: InvoiceRow, items: readonly ItemRow[]): Invoice {
  return {
    id: row.id,
    shopId: row.shopId,
    invoiceNo: row.invoiceNo,
    customerId: row.customerId,
    issuedAt: row.issuedAt,
    subtotal: Money.fromPaise(row.subtotalPaise),
    discount: Money.fromPaise(row.discountPaise),
    taxable: Money.fromPaise(row.taxablePaise),
    cgst: Money.fromPaise(row.cgstPaise),
    sgst: Money.fromPaise(row.sgstPaise),
    roundOff: Money.fromPaise(row.roundOffPaise),
    grandTotal: Money.fromPaise(row.grandTotalPaise),
    paid: Money.fromPaise(row.paidPaise),
    notes: row.notes,
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
    taxablePaise: invoice.taxable.paise,
    cgstPaise: invoice.cgst.paise,
    sgstPaise: invoice.sgst.paise,
    roundOffPaise: invoice.roundOff.paise,
    grandTotalPaise: invoice.grandTotal.paise,
    paidPaise: invoice.paid.paise,
    notes: invoice.notes,
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
    quantityAmount: item.quantity.amount,
    unitCode: item.quantity.unit.code,
    dimensionsJson: working.length > 0 ? JSON.stringify(working) : null,
    linePaise: item.lineTotal.paise,
    shopId,
    deviceId,
    updatedAt: Date.now(),
    deletedAt: null,
  };
}
