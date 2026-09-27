# ADR 0006 — The backup is plain JSON in the shop's own folder

**Status:** accepted

## Context

Android deletes everything an app owns when it is uninstalled: the SQLCipher
database, and the key that opens it. A lost phone, a factory reset, or a
relative clearing storage does the same. Until now the only thing that
survived was the PDFs of individual bills, and the app cannot read those back
— a PDF will not restore stock levels, the dues list or the catalogue.

[ADR 0001](0001-local-first.md) already committed to the shape: *"backup is a
first-class feature, not a later addition... the backup has to be written into
a user-granted folder that outlives the app."* This decides the rest.

Two things are in tension. A backup should be safe to leave lying in a folder,
which argues for encrypting it. But it must be readable on a phone that has
never seen this shop before, which rules out the only key the app has.

## Decision

- The backup is a single JSON file holding every row of every table, written
  into the same Storage Access Framework folder the shop already chose for its
  bills. Named `gupta-backup-2026-09-27-0905.json`, so a folder of them sorts
  by date and the shopkeeper can find yesterday's.
- It is **not** encrypted with the database key. That key lives in the Android
  Keystore and dies with the app, so a backup locked with it would be
  unreadable at precisely the moment it is needed.
- It is **not** encrypted with a passphrase either. A passphrase the owner
  forgets is the same data loss with extra steps, and this is a feature whose
  whole purpose is to survive the worst day the shop has.
- It is therefore plain text. The shop's bills are already in that same folder
  as PDFs carrying customer names, addresses, phone numbers and amounts in the
  clear, so this adds no exposure that is not there already.
- Rows are dumped `SELECT *`, by table name, rather than through the typed
  query builder. A backup has to carry every column as stored — the sync
  columns, and any column a later migration adds — and a hand-written field
  list would silently fall behind the schema.
- Restore is two steps. The file is read and its contents reported — how many
  bills, how many products, which shop — and only once the owner has seen
  those numbers is the database replaced. The replacement is one transaction.
- A backup from a newer format is refused rather than partially restored. It
  could hold tables this build has never heard of, and restoring it would drop
  them without saying so.

## Consequences

- A shop that backs up can reinstall on a new phone and get its books back.
  Without this, an uninstall is total loss.
- The backup is readable by anyone with the phone's file browser. That is a
  deliberate trade, made because the alternative failure — an unopenable
  backup — is worse and irreversible. If the shop ever holds data where this
  is not acceptable, the answer is to encrypt with a passphrase **escrowed
  somewhere**, not to encrypt with the Keystore key.
- Restoring replaces everything. There is no merge, because two devices do not
  sync and there is no sensible rule for combining two divergent shops.
- Backups are taken on demand, not on a schedule. A shopkeeper who forgets has
  no backup; a reminder, or a backup after every Nth bill, is the obvious next
  step and is not built.
- The format carries a version number so a future change can be migrated
  rather than guessed at.
