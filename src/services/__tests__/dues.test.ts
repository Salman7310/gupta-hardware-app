import { Money } from '../../core';
import { aCustomer, anInvoice } from '../../testing/builders';
import { WALK_IN, daysWaiting, duesFrom, emptyDues } from '../dues';

const DAY = 24 * 60 * 60 * 1000;
const MAR = 1_740_000_000_000;

const bill = (over: Parameters<typeof anInvoice>[0] = {}) =>
  anInvoice({ grandTotal: Money.fromRupees(1000), paid: Money.zero, ...over });

describe('what the shop is owed', () => {
  it('is nothing when every bill is settled', () => {
    const settled = bill({ paid: Money.fromRupees(1000) });
    const dues = duesFrom([settled], []);

    expect(dues.total.isZero()).toBe(true);
    expect(dues.billCount).toBe(0);
    expect(dues.customers).toHaveLength(0);
  });

  it('counts only what is left on a part-paid bill', () => {
    const part = bill({ paid: Money.fromRupees(400) });
    const dues = duesFrom([part], []);

    expect(dues.total.paise).toBe(60_000);
    expect(dues.billCount).toBe(1);
  });

  it('adds up several bills for the same customer under one name', () => {
    const mahesh = aCustomer({ id: 'c1', name: 'Mahesh Kumar' });
    const dues = duesFrom(
      [
        bill({ customerId: 'c1', issuedAt: MAR }),
        bill({ customerId: 'c1', issuedAt: MAR + DAY, paid: Money.fromRupees(250) }),
      ],
      [mahesh],
    );

    expect(dues.customers).toHaveLength(1);
    expect(dues.customers[0].name).toBe('Mahesh Kumar');
    expect(dues.customers[0].outstanding.paise).toBe(175_000);
    expect(dues.customers[0].bills).toHaveLength(2);
    expect(dues.billCount).toBe(2);
  });

  /** The debt to ask about is the one that has waited longest. */
  it('puts the oldest debt first, with each customer\'s bills oldest first', () => {
    const recent = aCustomer({ id: 'c1', name: 'Recent' });
    const old = aCustomer({ id: 'c2', name: 'Old' });
    const dues = duesFrom(
      [
        bill({ customerId: 'c1', issuedAt: MAR + 30 * DAY }),
        bill({ customerId: 'c2', issuedAt: MAR }),
        bill({ customerId: 'c2', issuedAt: MAR + 5 * DAY }),
      ],
      [recent, old],
    );

    expect(dues.customers.map((c) => c.name)).toEqual(['Old', 'Recent']);
    expect(dues.customers[0].bills.map((b) => b.invoice.issuedAt)).toEqual([MAR, MAR + 5 * DAY]);
    expect(dues.customers[0].oldestAt).toBe(MAR);
  });

  /**
   * A walk-in cannot be chased, so listing one line per walk-in bill would
   * push the customers who can be chased off the screen.
   */
  it('collapses walk-in sales into one entry', () => {
    const dues = duesFrom([bill({ customerId: null }), bill({ customerId: null })], []);

    expect(dues.customers).toHaveLength(1);
    expect(dues.customers[0].name).toBe(WALK_IN);
    expect(dues.customers[0].customerId).toBeNull();
    expect(dues.customers[0].outstanding.paise).toBe(200_000);
  });

  /** The money is still owed even if the customer record has gone. */
  it('keeps a bill whose customer has been removed', () => {
    const dues = duesFrom([bill({ customerId: 'vanished' })], []);

    expect(dues.billCount).toBe(1);
    expect(dues.customers[0].name).toBe(WALK_IN);
  });

  it('carries the phone number, which is how the shop actually chases a debt', () => {
    const mahesh = aCustomer({ id: 'c1', phone: '9988776677' });
    const dues = duesFrom([bill({ customerId: 'c1' })], [mahesh]);

    expect(dues.customers[0].phone).toBe('9988776677');
  });

  it('starts empty', () => {
    expect(emptyDues().total.isZero()).toBe(true);
    expect(duesFrom([], []).customers).toHaveLength(0);
  });
});

describe('how long a debt has waited', () => {
  it('counts whole days and never goes negative', () => {
    expect(daysWaiting(MAR, MAR)).toBe(0);
    expect(daysWaiting(MAR, MAR + DAY * 3 + 1000)).toBe(3);
    expect(daysWaiting(MAR + DAY, MAR)).toBe(0);
  });
});
