import { AppError, Id, Money, Quantity, Result, appError, err, ok } from '../core';
import { Invoice, InvoiceItem, LineItemInput } from '../models/invoice';
import { StockMovement } from '../models/stock-movement';
import { calculateBill } from './bill-calculator';
import { Identity } from './identity';
import { InvoiceNumberService } from './invoice-number';
import { Clock, IdGenerator, InvoiceRepository } from './ports';

/** A bill as the counter entered it, before numbering and calculation. */
export interface NewInvoice {
  readonly lines: readonly LineItemInput[];
  readonly customerId: Id | null;
  /** A lump sum off the bottom of the bill. Zero when the shop discounts per line. */
  readonly billDiscount: Money;
  readonly paid: Money;
  readonly notes: string | null;
}

function validate(input: NewInvoice): AppError | null {
  if (input.lines.length === 0) {
    return appError('invoice.empty', 'Add at least one item before saving the bill.');
  }

  for (const line of input.lines) {
    if (line.quantity.isZero()) {
      return appError('invoice.zeroQuantity', `Enter a quantity for ${line.name}.`);
    }
    if (line.quantity.amount < 0) {
      return appError('invoice.negativeQuantity', `Quantity for ${line.name} cannot be negative.`);
    }
  }

  if (input.paid.isNegative()) {
    return appError('invoice.negativePayment', 'Amount paid cannot be negative.');
  }

  if (input.billDiscount.isNegative()) {
    return appError('invoice.negativeDiscount', 'Discount cannot be negative.');
  }

  return null;
}

/**
 * Turns entered lines into a numbered, persisted bill.
 *
 * Stock is not checked before selling. The shop sells what is on the floor and
 * the ledger is only as good as what has been keyed in, so a stock figure that
 * disagrees with reality must not be able to block a sale at the counter.
 */
export class CreateInvoice {
  constructor(
    private readonly invoices: InvoiceRepository,
    private readonly numbers: InvoiceNumberService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly identity: Identity,
  ) {}

  async execute(input: NewInvoice): Promise<Result<Invoice, AppError>> {
    const problem = validate(input);
    if (problem) return err(problem);

    const totals = calculateBill(input.lines, input.billDiscount);

    // The calculator clamps a discount larger than the bill so a live total
    // never shows negative tax. Saving one is a different matter: it means the
    // figure on screen is not the figure asked for, so it is refused here.
    if (!totals.billDiscount.equals(input.billDiscount)) {
      return err(
        appError('invoice.discountTooLarge', 'The discount is more than the bill comes to.'),
      );
    }

    // Allocating the number before the write means a failed write burns it and
    // leaves a gap in the series. That is the lesser evil: holding the number
    // until after the write would let two fast taps take the same one, and a
    // duplicate invoice number is a worse problem with the tax authority than
    // a missing one. Sprint 7 should report gaps so they can be explained.
    const invoiceNo = await this.numbers.allocate(this.identity.shop, this.identity.device);
    const issuedAt = this.clock.now();
    const invoiceId = this.ids.next();

    const items: InvoiceItem[] = totals.lines.map((line) => ({
      id: this.ids.next(),
      invoiceId,
      productId: line.input.productId,
      name: line.input.name,
      quantity: line.input.quantity,
      rate: line.input.rate,
      taxRateBps: line.input.taxRateBps,
      discountBps: line.input.discountBps,
      discount: line.discount.add(line.billDiscountShare),
      lineTotal: line.total,
    }));

    // Sales leave the ledger as negative movements: the count is the sum of
    // its rows, never a figure this code is allowed to overwrite.
    const movements: StockMovement[] = totals.lines.map((line) => ({
      id: this.ids.next(),
      shopId: this.identity.shop.id,
      productId: line.input.productId,
      kind: 'sale',
      quantity: Quantity.of(-line.input.quantity.amount, line.input.quantity.unit.code),
      refInvoiceId: invoiceId,
      occurredAt: issuedAt,
      note: null,
    }));

    const invoice: Invoice = {
      id: invoiceId,
      shopId: this.identity.shop.id,
      invoiceNo,
      customerId: input.customerId,
      issuedAt,
      subtotal: totals.subtotal,
      discount: totals.discount,
      billDiscount: totals.billDiscount,
      taxable: totals.taxable,
      cgst: totals.cgst,
      sgst: totals.sgst,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      paid: input.paid,
      notes: input.notes,
      items,
    };

    try {
      await this.invoices.create(invoice, movements);
    } catch (e) {
      return err(
        appError(
          'invoice.notSaved',
          e instanceof Error ? e.message : 'The bill could not be saved.',
        ),
      );
    }

    return ok(invoice);
  }
}
