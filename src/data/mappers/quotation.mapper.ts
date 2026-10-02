import { Dimension, Money, Quantity, UnitCode } from '../../core';
import { Quotation, QuotationItem } from '../../models/quotation';
import { quotationItems, quotations } from '../db/schema';

type QuotationRow = typeof quotations.$inferSelect;
type QuotationInsert = typeof quotations.$inferInsert;
type ItemRow = typeof quotationItems.$inferSelect;
type ItemInsert = typeof quotationItems.$inferInsert;

function parseDimensions(json: string | null): readonly Dimension[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Dimension[]) : [];
  } catch {
    // A corrupt working note must not make the quotation unreadable; the
    // stored quantity is authoritative and is kept either way.
    return [];
  }
}

export function toQuotationItem(row: ItemRow): QuotationItem {
  return {
    id: row.id,
    quotationId: row.quotationId,
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

export function toQuotation(row: QuotationRow, items: readonly ItemRow[]): Quotation {
  return {
    id: row.id,
    shopId: row.shopId,
    quotationNo: row.quotationNo,
    customerId: row.customerId,
    issuedAt: row.issuedAt,
    validUntil: row.validUntil,
    subtotal: Money.fromPaise(row.subtotalPaise),
    discount: Money.fromPaise(row.discountPaise),
    billDiscount: Money.fromPaise(row.billDiscountPaise),
    taxable: Money.fromPaise(row.taxablePaise),
    cgst: Money.fromPaise(row.cgstPaise),
    sgst: Money.fromPaise(row.sgstPaise),
    roundOff: Money.fromPaise(row.roundOffPaise),
    grandTotal: Money.fromPaise(row.grandTotalPaise),
    acceptedInvoiceId: row.acceptedInvoiceId,
    notes: row.notes,
    items: items.map(toQuotationItem),
  };
}

export function toQuotationRow(quotation: Quotation, deviceId: string): QuotationInsert {
  return {
    id: quotation.id,
    shopId: quotation.shopId,
    quotationNo: quotation.quotationNo,
    customerId: quotation.customerId,
    issuedAt: quotation.issuedAt,
    validUntil: quotation.validUntil,
    subtotalPaise: quotation.subtotal.paise,
    discountPaise: quotation.discount.paise,
    billDiscountPaise: quotation.billDiscount.paise,
    taxablePaise: quotation.taxable.paise,
    cgstPaise: quotation.cgst.paise,
    sgstPaise: quotation.sgst.paise,
    roundOffPaise: quotation.roundOff.paise,
    grandTotalPaise: quotation.grandTotal.paise,
    acceptedInvoiceId: quotation.acceptedInvoiceId,
    notes: quotation.notes,
    deviceId,
    updatedAt: quotation.issuedAt,
    deletedAt: null,
  };
}

export function toQuotationItemRow(
  item: QuotationItem,
  shopId: string,
  deviceId: string,
  updatedAt: number,
): ItemInsert {
  const working = item.quantity.dimensions;
  return {
    id: item.id,
    quotationId: item.quotationId,
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
    updatedAt,
    deletedAt: null,
  };
}
