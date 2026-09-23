import { Money, divideRoundHalfUp } from '../core';
import { BillTotals, CalculatedLine, LineItemInput } from '../models/invoice';

/**
 * Pure bill arithmetic. No database, no React, no Expo — it can be tested
 * against the shop's real handwritten bills with nothing else running.
 *
 * Both discount shapes are supported, because the shop may use either and the
 * arithmetic differs. A per-line discount comes off that line before its tax.
 * A lump sum at the bottom of the bill is spread across the lines first and
 * each line is then taxed on its reduced share — see `calculateBill`.
 */
function taxed(input: LineItemInput, billDiscountShare: Money): CalculatedLine {
  const gross = input.rate.multiplyByScaled(input.quantity.amount, input.quantity.unit.scale);
  const discount = gross.percentage(input.discountBps);
  const taxable = gross.subtract(discount).subtract(billDiscountShare);
  const tax = taxable.percentage(input.taxRateBps);

  // Halve each line's tax rather than the bill total, so CGST and SGST always
  // add back up to the tax charged, to the paisa.
  const cgst = Money.fromPaise(divideRoundHalfUp(tax.paise, 2));
  const sgst = tax.subtract(cgst);

  return {
    input,
    gross,
    discount,
    billDiscountShare,
    taxable,
    cgst,
    sgst,
    tax,
    total: taxable.add(tax),
  };
}

export function calculateLine(input: LineItemInput): CalculatedLine {
  return taxed(input, Money.zero);
}

/**
 * Splits a lump sum across lines in proportion to what each contributes to the
 * taxable value, giving the paise that division cannot split to the lines with
 * the largest remainder. The shares therefore add back to exactly the discount
 * given, which a per-line percentage could not guarantee.
 */
function apportion(total: Money, weights: readonly number[]): Money[] {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (total.isZero() || totalWeight <= 0) return weights.map(() => Money.zero);

  const exact = weights.map((w) => (total.paise * w) / totalWeight);
  const shares = exact.map((e) => Math.floor(e));
  let unallocated = total.paise - shares.reduce((sum, s) => sum + s, 0);

  const byRemainder = exact
    .map((e, index) => ({ index, remainder: e - Math.floor(e) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const { index } of byRemainder) {
    if (unallocated <= 0) break;
    shares[index] += 1;
    unallocated -= 1;
  }

  return shares.map((paise) => Money.fromPaise(paise));
}

/**
 * A discount recorded on the face of the invoice reduces the taxable value
 * rather than the amount payable, so a lump sum cannot simply be taken off the
 * grand total: tax has already been charged line by line, and lines may carry
 * different rates. It is apportioned across the lines by taxable value and the
 * tax recomputed, which is what keeps the printed CGST and SGST consistent
 * with the taxable value beside them.
 */
export function calculateBill(
  inputs: readonly LineItemInput[],
  billDiscount: Money = Money.zero,
): BillTotals {
  // Clamped rather than rejected: this runs on every keystroke behind a live
  // total, and a half-typed figure must not put a negative tax on screen.
  // CreateInvoice refuses to save what is out of range.
  const requested = billDiscount.isNegative() ? Money.zero : billDiscount;
  const beforeBillDiscount = inputs.map((input) => taxed(input, Money.zero));
  const weights = beforeBillDiscount.map((l) => l.taxable.paise);
  const ceiling = Math.max(
    weights.reduce((sum, w) => sum + w, 0),
    0,
  );
  const applied = requested.paise > ceiling ? Money.fromPaise(ceiling) : requested;

  const shares = apportion(applied, weights);
  const lines = inputs.map((input, index) => taxed(input, shares[index]));

  const subtotal = Money.sum(lines.map((l) => l.gross));
  const lineDiscount = Money.sum(lines.map((l) => l.discount));
  const taxable = Money.sum(lines.map((l) => l.taxable));
  const cgst = Money.sum(lines.map((l) => l.cgst));
  const sgst = Money.sum(lines.map((l) => l.sgst));
  const taxTotal = cgst.add(sgst);

  const beforeRounding = taxable.add(taxTotal);
  const rounded = Money.fromPaise(divideRoundHalfUp(beforeRounding.paise, 100) * 100);
  const roundOff = rounded.subtract(beforeRounding);

  return {
    lines,
    subtotal,
    lineDiscount,
    billDiscount: applied,
    discount: lineDiscount.add(applied),
    taxable,
    cgst,
    sgst,
    taxTotal,
    roundOff,
    grandTotal: rounded,
  };
}
