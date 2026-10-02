import { AppError, Id, Money, Result, appError, err, ok } from '../core';
import { LineItemInput } from '../models/invoice';
import { DAY_MS, Quotation, QuotationItem } from '../models/quotation';
import { calculateBill } from './bill-calculator';
import { Identity } from './identity';
import { QuotationNumberService } from './quotation-number';
import { Clock, IdGenerator, QuotationRepository } from './ports';

/** An estimate as the counter entered it, before numbering and calculation. */
export interface NewQuotation {
  readonly lines: readonly LineItemInput[];
  readonly customerId: Id | null;
  readonly billDiscount: Money;
  /** How many days the prices stand from today. */
  readonly validDays: number;
  readonly notes: string | null;
}

function validate(input: NewQuotation): AppError | null {
  if (input.lines.length === 0) {
    return appError('quotation.empty', 'Add at least one item before saving the quotation.');
  }

  for (const line of input.lines) {
    if (line.quantity.isZero()) {
      return appError('quotation.zeroQuantity', `Enter a quantity for ${line.name}.`);
    }
    if (line.quantity.amount < 0) {
      return appError(
        'quotation.negativeQuantity',
        `Quantity for ${line.name} cannot be negative.`,
      );
    }
  }

  if (input.billDiscount.isNegative()) {
    return appError('quotation.negativeDiscount', 'Discount cannot be negative.');
  }

  if (input.validDays <= 0) {
    return appError('quotation.notValid', 'A quotation has to stand for at least a day.');
  }

  return null;
}

/**
 * Turns entered lines into a numbered, saved estimate.
 *
 * Priced by the same calculator as a bill, deliberately: the figure quoted has
 * to be the figure charged, down to the paisa, or the estimate is worse than
 * useless. Nothing else about a sale happens here — no stock moves, no number
 * is taken from the invoice series and nothing is owed, because nothing has
 * been sold.
 */
export class CreateQuotation {
  constructor(
    private readonly quotations: QuotationRepository,
    private readonly numbers: QuotationNumberService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly identity: Identity,
  ) {}

  async execute(input: NewQuotation): Promise<Result<Quotation, AppError>> {
    const problem = validate(input);
    if (problem) return err(problem);

    const totals = calculateBill(input.lines, input.billDiscount);

    // The calculator clamps a discount larger than the bill so a live total
    // never shows negative tax. Saving one is refused for the same reason as
    // on a bill: the figure quoted would not be the figure asked for.
    if (!totals.billDiscount.equals(input.billDiscount)) {
      return err(
        appError('quotation.discountTooLarge', 'The discount is more than the quotation comes to.'),
      );
    }

    const quotationNo = await this.numbers.allocate(this.identity.shop, this.identity.device);
    const issuedAt = this.clock.now();
    const quotationId = this.ids.next();

    const items: QuotationItem[] = totals.lines.map((line) => ({
      id: this.ids.next(),
      quotationId,
      productId: line.input.productId,
      name: line.input.name,
      quantity: line.input.quantity,
      rate: line.input.rate,
      taxRateBps: line.input.taxRateBps,
      hsnCode: line.input.hsnCode ?? null,
      discountBps: line.input.discountBps,
      discount: line.discount.add(line.billDiscountShare),
      lineTotal: line.total,
    }));

    const quotation: Quotation = {
      id: quotationId,
      shopId: this.identity.shop.id,
      quotationNo,
      customerId: input.customerId,
      issuedAt,
      validUntil: issuedAt + input.validDays * DAY_MS,
      subtotal: totals.subtotal,
      discount: totals.discount,
      billDiscount: totals.billDiscount,
      taxable: totals.taxable,
      cgst: totals.cgst,
      sgst: totals.sgst,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      acceptedInvoiceId: null,
      notes: input.notes,
      items,
    };

    try {
      await this.quotations.create(quotation);
    } catch (e) {
      return err(
        appError(
          'quotation.notSaved',
          e instanceof Error ? e.message : 'The quotation could not be saved.',
        ),
      );
    }

    return ok(quotation);
  }
}
