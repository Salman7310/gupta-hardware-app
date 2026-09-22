# Gupta Hardware

Offline-first Android billing and stock app for a hardware shop selling tiles,
marble, granite, wall putty and paint. The shop writes every bill by hand today.

## What it does

- Build a bill from many line items, with discount, GST and the total calculated
  as the shopkeeper types
- Handles each product in the unit it is actually sold in — marble and granite
  by square feet from length by width, tiles by the box, putty by the bag, paint
  by the litre
- Produces a GST invoice as a PDF and shares it to the customer over WhatsApp
- Tracks stock as a ledger of movements, with live quantities and low-stock alerts
- Scans paper bills with the camera and keeps them as a searchable archive

Not distributed through the Play Store. Installed directly on the shop's phone.

## Status

Project setup and the calculation core are in place. Sprint 1 is under way.
See [`docs/sprints.md`](docs/sprints.md) for the plan.

| Area                               | State                                   |
| ---------------------------------- | --------------------------------------- |
| Money and quantity value objects   | done, unit and property tested          |
| Bill calculator                    | done for line-level discount            |
| Database schema and migration      | done, sync columns in place             |
| Product repository and list screen | done, reference vertical slice          |
| Database encryption                | not started — see Sprint 1              |
| Backup and restore                 | not started — Sprint 5, gates real data |
| PDF, scanner, reports              | not started                             |

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
7. Discount: per line, or one lump sum at the bottom? Only line-level is
   implemented, because a bill-level discount has to be apportioned across lines
   before tax and the rule cannot be guessed.
8. Are quotations written before a sale, and how often does one become a bill?

GST rates and HSN codes should be read off the shop's existing bills and
confirmed by their accountant, not looked up.
