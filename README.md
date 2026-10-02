# Gupta Hardware

Offline-first Android billing and stock app for a hardware shop selling tiles,
marble, granite, wall putty and paint. The shop writes every bill by hand today.

## What it does

- Build a bill from many line items, with discount, GST and the total calculated
  as the shopkeeper types
- Handles each product in the unit it is actually sold in — marble and granite
  by square feet (typed as a total, or measured piece by piece), tiles by the
  box, putty by the bag, paint by the litre
- Prints the HSN code and GST rate on every line, and the tax by rate on a bill
  that mixes rates
- Produces a GST invoice as a PDF and shares it to the customer over WhatsApp
- Prices up a job as a quotation before anything is sold, shares it as a PDF,
  and reopens it as a bill when the customer accepts
- Tracks stock as a ledger of movements, with live quantities and low-stock alerts
- Scans paper bills with the camera and keeps them as a searchable archive

Not distributed through the Play Store. Installed directly on the shop's phone.

## Status

Sprint 3 is built but not closed. Bills can be written, saved and looked up,
and both discount rules are implemented. It stays open until the five
handwritten bills are in the repo and the golden tests reproduce them to the
paisa, which is the sprint's own definition of done.
See [`docs/sprints.md`](docs/sprints.md).

| Area                                | State                                          |
| ----------------------------------- | ---------------------------------------------- |
| Money and quantity value objects    | done, unit and property tested                 |
| Bill calculator                     | done, line discount and apportioned lump sum   |
| Database schema and migrations      | done, sync columns in place                    |
| Database encryption                 | done, SQLCipher with a Keystore-held key       |
| Shop and device identity            | done, first-run setup screen                   |
| Invoice numbering                   | done, per-device series                        |
| Repositories and ports              | done for products, customers, invoices, stock  |
| In-memory fakes and ViewModel tests | done                                           |
| Product list with live stock        | done                                           |
| Product create and edit             | done, form driven by the unit                  |
| Stock ledger                        | done, totals derived by summing movements      |
| Receiving stock and counting it     | done, on the product: deliveries in, counts put right |
| CSV catalogue import                | done, with preview and per-row errors          |
| Creating an invoice                 | done, one transaction, tested against SQLite   |
| Billing screen                      | done, walk-in or a named customer              |
| Stone measured length by width      | done, feet and inches, working kept on the bill|
| Bills list and bill detail          | done, newest first, paid / part paid / unpaid  |
| Icon, launch screen, design system  | done                                           |
| Customer picker                     | done, name and mobile printed on the bill      |
| Adding items to an issued bill      | done, same number, whole bill recalculated     |
| Cancelling a bill, deleting a quote | done, a bill keeps its number and is marked cancelled |
| HSN and GST rate on the invoice     | done, copied from the product when sold        |
| Golden tests from the shop's bills  | not started — waiting on the bills             |
| Barcode lookup                      | not done — deferred, see below                 |
| PDF bill, share and saved copy       | done, saved outside the app so it survives an uninstall |
| Part payments and dues              | done, receipts kept as a ledger                |
| Quotations                          | done, own series, shared pricing, converts to a bill |
| Shop details                        | done, editable after setup, printed on every document |
| Send a bill or quote on WhatsApp    | done, PDF straight to the customer's chat      |
| Backup and restore                  | done, whole shop to the folder that outlives the app |
| Release signing                     | done, own keystore; updates install over each other |
| Scanner, reports                    | not started                                    |

Known problems, none of them cosmetic:

- CGST and SGST are each worked out at half the rate and rounded on their own,
  so they always print equal. The shop's accountant has not yet confirmed this
  is how they want it; the golden tests from real bills will settle it.
- Stock is allowed to go negative, deliberately, so a wrong stock figure can
  never block a sale at the counter. The product list flags it "Below zero",
  and the product's own screen offers "Correct the count".
- Two devices do not sync. Each keeps its own bills, stock and dues; only the
  bill-number series is designed to avoid collisions between counters.
- Backups are manual. A shopkeeper who never taps the button has none, though
  the Shop screen now says "Never" in red until one exists.

Barcode scanning was in the Sprint 2 plan and was deliberately dropped rather
than rushed. It needs camera permission plumbing and another native rebuild,
and tiles and stone are identified by name and size, not barcode. It belongs
with sanitaryware, which is not yet in the catalogue.

## Getting started

Requires a JDK 17, the Android SDK, and a device or emulator. Expo Go will not
work: the app needs native modules, so it runs as a development build.

```bash
npm install
npx expo prebuild --clean
npm run android
```

| Command               | Does                                                   |
| --------------------- | ------------------------------------------------------ |
| `npm run android`     | build and launch the development build                 |
| `npm run verify`      | typecheck, lint and test — what CI runs                |
| `npm test`            | Jest unit tests                                        |
| `npm run db:generate` | regenerate the Drizzle migration after a schema change |

## Architecture

MVVM with a dependency rule that points inwards, described in
[ADR 0003](docs/adr/0003-mvvm-layering.md).

```
app/                  Expo Router routes — thin entry points
src/
  core/               Money, Quantity, Unit, Result — framework-free
  models/             domain entities
  services/           business rules and repository interfaces (ports)
  data/               Drizzle schema, repositories, mappers (adapters)
  viewmodels/         hooks holding screen state and commands
  views/              screens and components
  di/                 composition root
docs/adr/             architecture decision records
```

`src/core`, `src/models` and `src/services` must not import React, Expo, Drizzle
or anything from the outer layers. This is enforced by `no-restricted-imports`
in `eslint.config.js` and fails CI, not left to discipline. To check it is live,
add `import { View } from 'react-native'` to a file in `src/core` and run
`npm run lint` — it must fail.

### Two rules worth knowing before writing code

**Money is integer paise.** No `number` typed as rupees exists anywhere. Floats
lose a paisa on an eighteen-percent calculation and the shopkeeper notices. See
[ADR 0002](docs/adr/0002-money-and-rounding.md).

**A quotation is not an unsold bill.** It has its own tables and its own number
series, moves no stock and is owed by nobody, but is priced by the same
calculator so the estimate matches the bill to the paisa. See
[ADR 0005](docs/adr/0005-quotations-are-not-invoices.md).

**Quantities are integer sub-units.** Marble is stored as square inches, not
square feet, so 5'6" by 2'3" is exactly 1782 square inches. Paint is millilitres.
Tiles and bags are whole counts. Division happens once, at the end.

## Branches

- `main` — known-good. Merged from `development` once verified.
- `development` — active work. Feature branches merge here.

CI runs `npm run verify` on both.

## Open questions for the shop

These change the calculation rules and are not safe to guess. They need
answering before the billing screen is built.

1. Marble: is each piece's area rounded up, to the next quarter or half foot?
2. Marble: is polishing or edge cutting charged separately, per running foot?
3. Tiles: are loose pieces ever sold, and at what rate?
4. Paint: is a 20 litre tin cheaper per litre than four 4 litre tins?
5. Paint: is the shade code recorded on the bill?
6. Putty: is more than one bag weight stocked per brand? If so they are separate
   products.
7. Discount: per line, or one lump sum at the bottom? Both are implemented, so
   this no longer blocks anything — a lump sum is apportioned across the lines
   by taxable value before tax, which is the method the GST guidance describes.
   Still worth confirming which the shop uses, so the screen can lead with it.
8. Quotations: how long should the prices hold? Seven days is the default and
   is a guess. The app now records which estimates became bills, so how often
   one converts will answer itself once the shop has used it for a month.

GST rates and HSN codes should be read off the shop's existing bills and
confirmed by their accountant, not looked up.
