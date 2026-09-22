import { Money, divideRoundHalfUp } from '../core';
import { BillTotals, CalculatedLine, LineItemInput } from '../models/invoice';

/**
 * Pure bill arithmetic. No database, no React, no Expo — it can be tested
 * against the shop's real handwritten bills with nothing else running.
 *
 * Open question for the shop (see README): whether discount is given per line
 * or as one lump sum at the bottom of the bill. Only line-level discount is
 * implemented until that is confirmed, because a bill-level discount has to be
 * apportioned across lines before tax and guessing the rule would be wrong.
 */
export function calculateLine(input: LineItemInput): CalculatedLine {
  const gross = input.rate.multiplyByScaled(input.quantity.amount, input.quantity.unit.scale);
  const discount = gross.percentage(input.discountBps);
  const taxable = gross.subtract(discount);
  const tax = taxable.percentage(input.taxRateBps);

  // Halve each line's tax rather than the bill total, so CGST and SGST always
  // add back up to the tax charged, to the paisa.
  const cgst = Money.fromPaise(divideRoundHalfUp(tax.paise, 2));
  const sgst = tax.subtract(cgst);

  return { input, gross, discount, taxable, cgst, sgst, tax, total: taxable.add(tax) };
}

export function calculateBill(inputs: readonly LineItemInput[]): BillTotals {
  const lines = inputs.map(calculateLine);

  const subtotal = Money.sum(lines.map((l) => l.gross));
  const discount = Money.sum(lines.map((l) => l.discount));
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
    discount,
    taxable,
    cgst,
    sgst,
    taxTotal,
    roundOff,
    grandTotal: rounded,
  };
}
