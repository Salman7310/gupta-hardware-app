# Sprint plan

Two-week sprints. Timings assume roughly full-time work; part-time, expect five
to six months rather than four.

## Definition of done — every sprint

Typecheck passes under `strict`. Lint passes including the dependency rule.
Tests pass. Any schema change ships with a migration. Every money path still
uses `Money`, never `number`. The feature works with the phone in aeroplane
mode. Demoed on the shop's actual phone model, not an emulator.

## Sprint 0 — Foundation ✅

Dev build runs on a real phone, CI green, architecture rules enforced by tooling.
Collect five real handwritten bills and document every unit and tax rate.

**Done when** a blank screen runs on the phone, and a PR importing `expo-sqlite`
inside `src/core` fails CI.

## Sprint 1 — Domain core and persistence (in progress)

`Money`, `Quantity`, `Unit` with the scale-and-round formula. Drizzle schema
with ULID keys and sync columns. Repository ports, Drizzle implementations,
in-memory fakes. SQLCipher with the key in `expo-secure-store`.

**Done when** the encrypted database opens on device and no `number` touches a
rupee anywhere.

## Sprint 2 — Products and stock

Product CRUD. Stock as a movements ledger, never a mutable counter. Product list
with search. Per-unit product form driven by the unit definition. Barcode lookup.

CSV import belongs here. The shop has several hundred SKUs; if the only way in
is typing them on a phone, the project dies at this step.

**Done when** the real catalogue is loaded and stock derives from movements.

## Sprint 3 — Billing engine and screen

The sprint the product lives or dies on. `BillCalculator` extended for whatever
discount rule the shop confirms. `CreateInvoice` writing invoice, items and stock
movements in one transaction. Per-device invoice numbering. The dimension keypad
for stone — budget three days for that screen alone.

**Done when** the app reproduces all five handwritten bills to the paisa.

## Sprint 4 — PDF and share

HTML invoice template matching the shop's existing layout, Noto Sans embedded as
base64 so the rupee sign renders, page-break handling for long bills. Share via
the system sheet to WhatsApp. Shop settings: name, address, GSTIN, logo, prefix.

**Done when** a printed bill is handed to a real customer without comment.

## Sprint 5 — Backup, restore and lock — GATE

**No real production data enters the app until this ships.**

Folder picked through the Storage Access Framework with persisted permission.
Nightly encrypted backup of database and images, rolling thirty copies. Restore
with a preview before overwriting. Backup encrypted with an owner passphrase,
not the Keystore key, so it restores onto a different phone. App lock.

Spike the document scanner for one timeboxed day here so Sprint 6 does not
ambush the schedule.

**Done when** on a physical phone: uninstall, reinstall, restore, everything
returns. Run it twice.

## Sprint 6 — Scanner and OCR

Highest technical risk. Document scanner, ML Kit text recognition, a parser for
date, amount, vendor and GSTIN, and a verify-and-edit form — never save an
extracted number silently.

**Cut option:** ship photo capture plus manual entry and defer OCR. A searchable
photo archive with typed amounts still delivers most of the value.

## Sprint 7 — Reports and hardening

Daily and monthly sales, item-wise sales, low stock, pending payments, customer
ledger. Diagnostics export. A test asserting every table still carries `shopId`,
`updatedAt` and `deletedAt`. Performance pass against a seeded 5,000-bill
database. Large touch targets — this is used one-handed at a counter.

## Sprint 8 — Pilot and release

Release keystore, backed up in two places; losing it means never shipping an
update that installs over the shop's app without wiping their data. In-app
update check. Maestro end-to-end over open → bill → PDF → share. Crash
reporting. One hour of training and a printed one-page cheat sheet.

Then the parallel run: app and paper book side by side, every mismatch a P1.

**Done when** seven consecutive days pass with zero mismatches.

## Cut line, in order

Drop OCR first, then reports beyond daily sales, then barcode scanning.

Never cut Sprint 5, never cut the golden tests in Sprint 3, never cut the
parallel run.
