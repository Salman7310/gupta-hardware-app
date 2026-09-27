# ADR 0005 — A quotation is its own document, not an unsold invoice

**Status:** accepted

## Context

Customers walk in and ask what a job would cost before they buy: twelve feet
of marble, four bags of putty, what does that come to. The shop wants to hand
them an estimate they can take away and think about, and to be able to find it
again when they come back.

The obvious implementation is a flag on `invoices` — an invoice in a `quoted`
state that becomes a real one when accepted. It is also the wrong one, and
expensively so.

A GST invoice series has to be consecutive. If an estimate takes a number from
it, every quote that never becomes a sale leaves a gap the shop has to be able
to explain to the tax authority. An estimate also moves no stock, is owed by
nobody, and must never appear in a dues total or a debtor list. Under a shared
table, every one of those queries becomes a place where forgetting the filter
silently produces a wrong figure — stock that has left the shelf for a sale
that never happened, or a customer chased for money they do not owe.

Against that, the arithmetic has to be identical. An estimate the customer is
later charged a different amount for is worse than no estimate at all.

## Decision

- Quotations live in their own tables, `quotations` and `quotation_items`,
  shaped like the invoice pair. No flag, no shared table, no shared queries.
- They take their numbers from their own per-device series,
  `GH/QA/0007` — prefix, `Q`, device letter, sequence — so the invoice series
  stays consecutive and nobody holding the paper can mistake one for the other.
- They are priced by `calculateBill`, the same function that prices a bill, and
  a test asserts the two agree to the paisa for the same lines.
- They are entered through the same components and the same `useLineEntry`
  hook as a bill, so the two forms cannot drift apart.
- Every quotation carries a `validUntil`. Expiry is derived from it against the
  clock, never stored, so nothing has to run at midnight to keep it honest.
  Acceptance *is* stored, in `acceptedInvoiceId`, because it is a fact about
  what happened rather than about the time.
- The printed document says in words that it is an estimate and not a tax
  invoice, that no tax has been charged, and the date its prices stop standing.
- An accepted quotation reopens as a pre-filled bill, editable before it is
  saved, and the quotation is then linked to the invoice it became.

## Consequences

- Nothing about billing, stock or dues changed to make room for this. Those
  queries cannot see quotations at all, which is the point.
- The estimate and the bill share their arithmetic, their entry components and
  their document styling. A fix to the marble entry or the tax split lands on
  both, and neither can quote a figure the other would not charge.
- Unlike a bill, a quotation is **not** written automatically into the shop's
  documents folder. A bill is a record the shop is obliged to produce years
  later ([ADR 0004](0004-where-bills-are-kept.md)); an estimate is an offer,
  and most offers are never taken up. Filling the records folder with them
  would bury the documents that matter. Save PDF is there when it is wanted.
- A quotation cannot be edited after it is saved. It has been handed to a
  customer, so changing it would change what they were told. The way to revise
  an estimate is to write a new one, which also gives it a fresh validity date.
- Billing the same quotation twice is not blocked outright, but the second
  attempt is visible: the detail screen shows the bill it already became
  instead of the convert action.
