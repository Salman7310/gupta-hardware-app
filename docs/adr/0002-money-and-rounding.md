# ADR 0002 — Money is integer paise, rounded once

**Status:** accepted

## Context

JavaScript numbers are binary floats. `0.1 + 0.2` is `0.30000000000000004`.
Run eleven marble line items through an 18% tax calculation in floats and the
grand total lands a paisa off. A shopkeeper who has added bills by hand for
thirty years notices, and stops trusting the app.

## Decision

- All monetary values are whole numbers of paise, held in `Money`. No `number`
  typed as rupees exists anywhere in the codebase.
- All quantities are whole numbers of sub-units: square inches for stone,
  millilitres for paint, whole counts for boxes and bags.
- Tax and discount rates are basis points. 1800 means 18%.
- Division happens once, at the end of a calculation, through
  `divideRoundHalfUp`, which rounds halves away from zero.
- CGST and SGST are computed per line by halving that line's tax, so the two
  always add back to the tax charged.

## Consequences

- Marble measured as 5'6" by 2'3" is stored as 66 by 27 whole inches and the
  area as 1782 square inches, which is exact. Converting to 5.5 feet first would
  not be: 5 inches is 0.41666… feet and the error compounds across a twelve
  piece order.
- Money must be formatted only at the edge, never parsed back from a string.
- `Money.fromRupees` exists for input parsing and tests only.
