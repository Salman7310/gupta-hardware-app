import { Id, Money } from '../core';
import { Customer } from '../models/customer';
import { Invoice, amountDue } from '../models/invoice';

/** One unsettled bill, with what is still owed on it. */
export interface DueBill {
  readonly invoice: Invoice;
  readonly due: Money;
}

/**
 * What one customer owes across all their bills.
 *
 * Walk-in sales collapse into a single unnamed entry rather than one per bill.
 * The shop cannot chase a walk-in anyway, so listing them separately would
 * push the customers who can be chased down the screen.
 */
export interface CustomerDue {
  readonly customerId: Id | null;
  readonly name: string;
  readonly phone: string | null;
  readonly outstanding: Money;
  /** Oldest first: the debt to ask about is the one that has waited longest. */
  readonly bills: readonly DueBill[];
  readonly oldestAt: number;
}

export interface DuesSummary {
  readonly total: Money;
  readonly billCount: number;
  /** Ordered by the oldest unpaid bill, so the longest wait is at the top. */
  readonly customers: readonly CustomerDue[];
}

export const WALK_IN = 'Walk-in customer';

export const emptyDues = (): DuesSummary => ({
  total: Money.zero,
  billCount: 0,
  customers: [],
});

/**
 * Turns bills into what each customer owes.
 *
 * Derived on every read rather than stored. A total that is kept somewhere
 * drifts the moment a payment is recorded on another device, and the whole
 * point of the payments ledger is that the figure is arithmetic over rows.
 */
export function duesFrom(
  invoices: readonly Invoice[],
  customers: readonly Customer[],
): DuesSummary {
  const byId = new Map(customers.map((c) => [c.id, c]));
  const groups = new Map<string, { customer: Customer | null; bills: DueBill[] }>();

  for (const invoice of invoices) {
    const due = amountDue(invoice);
    if (due.isZero()) continue;

    // A bill whose customer has since been removed is still owed, so it falls
    // in with the walk-ins rather than disappearing from the list.
    const customer = invoice.customerId ? (byId.get(invoice.customerId) ?? null) : null;
    const key = customer ? customer.id : '';

    const group = groups.get(key) ?? { customer, bills: [] };
    group.bills.push({ invoice, due });
    groups.set(key, group);
  }

  const customersDue: CustomerDue[] = [...groups.values()].map(({ customer, bills }) => {
    const ordered = [...bills].sort((a, b) => a.invoice.issuedAt - b.invoice.issuedAt);
    return {
      customerId: customer?.id ?? null,
      name: customer?.name ?? WALK_IN,
      phone: customer?.phone ?? null,
      outstanding: Money.sum(ordered.map((b) => b.due)),
      bills: ordered,
      oldestAt: ordered[0].invoice.issuedAt,
    };
  });

  customersDue.sort((a, b) => a.oldestAt - b.oldestAt);

  return {
    total: Money.sum(customersDue.map((c) => c.outstanding)),
    billCount: customersDue.reduce((n, c) => n + c.bills.length, 0),
    customers: customersDue,
  };
}

/** How long a debt has been waiting, as the shop would say it. */
export function daysWaiting(oldestAt: number, now: number): number {
  const DAY = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((now - oldestAt) / DAY));
}
