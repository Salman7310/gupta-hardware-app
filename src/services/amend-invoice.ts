import { AppError, Quantity, Result, appError, err, ok } from '../core';
import { Invoice, InvoiceItem, LineItemInput, toLineInput } from '../models/invoice';
import { StockMovement } from '../models/stock-movement';
import { calculateBill } from './bill-calculator';
import { Identity } from './identity';
import { Clock, IdGenerator, InvoiceRepository } from './ports';

/**
 * Adding to a bill the customer has already been given.
 *
 * The shop asked for this because of what actually happens at a counter: the
 * bill is made, and before the customer leaves they want two more bags. Two
 * bills for one purchase is the wrong answer, so the bill grows.
 *
 * Everything is recalculated from all the lines rather than the new total
 * being bolted onto the old one. A lump sum off the bottom of the bill is
 * apportioned across every line by taxable value, so adding a line moves what
 * the existing lines came to — and the tax with it. Nothing is patched.
 *
 * The rates on the existing lines are the rates they were sold at. They are
 * re-entered from what was stored, never read back off the catalogue, so a
 * price change since the bill was written cannot rewrite it.
 */
export class AmendInvoice {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly identity: Identity,
  ) {}

  async execute(
    invoice: Invoice,
    added: readonly LineItemInput[],
  ): Promise<Result<Invoice, AppError>> {
    if (added.length === 0) {
      return err(appError('amend.empty', 'Add at least one item.'));
    }

    for (const line of added) {
      if (line.quantity.isZero()) {
        return err(appError('amend.zeroQuantity', `Enter a quantity for ${line.name}.`));
      }
      if (line.quantity.amount < 0) {
        return err(
          appError('amend.negativeQuantity', `Quantity for ${line.name} cannot be negative.`),
        );
      }
    }

    const existing = invoice.items.map(toLineInput);
    const totals = calculateBill([...existing, ...added], invoice.billDiscount);

    // The clamp would mean the discount no longer matches what was agreed.
    if (!totals.billDiscount.equals(invoice.billDiscount)) {
      return err(
        appError('amend.discountTooLarge', 'The discount is more than the bill comes to.'),
      );
    }

    const amendedAt = this.clock.now();

    // Existing lines keep their ids so the row is updated rather than
    // replaced; only the lines being added are new.
    const items: InvoiceItem[] = totals.lines.map((line, index) => {
      const previous: InvoiceItem | undefined = invoice.items[index];
      return {
        id: previous?.id ?? this.ids.next(),
        invoiceId: invoice.id,
        productId: line.input.productId,
        name: line.input.name,
        quantity: line.input.quantity,
        rate: line.input.rate,
        taxRateBps: line.input.taxRateBps,
        hsnCode: line.input.hsnCode ?? null,
        discountBps: line.input.discountBps,
        discount: line.discount.add(line.billDiscountShare),
        lineTotal: line.total,
      };
    });

    // Only the new lines take stock off the shelf. The existing ones already
    // did when the bill was written.
    const movements: StockMovement[] = added.map((line) => ({
      id: this.ids.next(),
      shopId: this.identity.shop.id,
      productId: line.productId,
      kind: 'sale',
      quantity: Quantity.of(-line.quantity.amount, line.quantity.unit.code),
      refInvoiceId: invoice.id,
      occurredAt: amendedAt,
      note: null,
    }));

    const amended: Invoice = {
      ...invoice,
      subtotal: totals.subtotal,
      discount: totals.discount,
      billDiscount: totals.billDiscount,
      taxable: totals.taxable,
      cgst: totals.cgst,
      sgst: totals.sgst,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      amendedAt,
      items,
    };

    try {
      await this.invoices.amend(amended, movements);
    } catch (e) {
      return err(
        appError(
          'amend.notSaved',
          e instanceof Error ? e.message : 'The bill could not be changed.',
        ),
      );
    }

    return ok(amended);
  }
}
