# ADR 0004 — Generated bills are kept outside the app

**Status:** accepted

## Context

The shop needs a bill it can hand to a customer and a copy it can keep. Both
are the same PDF, but they answer different questions, and only one of them is
about durability.

Android deletes everything an app owns when that app is uninstalled. That
covers `documentDirectory`, `cacheDirectory` and the SQLite database this app
already keeps its bills in. A shopkeeper who changes phone, clears storage to
free space, or is told by a relative to reinstall the app, loses every bill the
app was holding. Tax records in India are expected to be produced years later.
An archive that a routine uninstall can destroy is not an archive.

Android's own auto-backup was considered and rejected. It is capped, it can be
switched off by the user or the device maker, it does not run on every device,
and nothing in it is visible to the shopkeeper as a file they can point at.

## Decision

- Bills are rendered to PDF with the system print engine, from self-contained
  HTML built in `src/services/bill-document.ts`. No network, no external font,
  no image, because the shop bills with no signal.
- The shop nominates a folder once, through Android's own folder picker, and
  the grant is remembered in settings under `bills.folderUri`. Downloads or a
  folder the owner makes is typical.
- Every bill is written into that folder as it is saved, named after its bill
  number, for example `GH-A-0001.pdf`. Saving happens through the Storage
  Access Framework, so the file lives outside the app sandbox.
- Sharing is separate. It renders the same document to temporary storage and
  hands it to the system share sheet. It deliberately keeps nothing.
- The automatic save only runs once a folder has been granted. The first bill
  of the day is the wrong moment to put a system picker in front of someone at
  a counter, so the prompt is attached to Save PDF on a bill instead.

## Consequences

- Uninstalling the app does not touch the saved bills. They remain in the
  chosen folder, visible in the Files app, and are swept up by whatever backup
  the phone already does, typically Google Photos or Drive for that folder.
- The app cannot read its own archive back. A Storage Access Framework grant is
  write-and-browse through the system picker, not a path, so the bill list is
  still driven by the database. The folder is the record of last resort, not a
  second source of truth.
- If the owner deletes the folder or revokes the grant, the next save fails
  once, the stored uri is forgotten, and the following save asks for a folder
  again rather than failing for good.
- A bill only ever shared, never saved, exists on WhatsApp and nowhere else.
  That is why the save is automatic rather than a second deliberate tap.
