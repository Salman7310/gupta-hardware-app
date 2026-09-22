# ADR 0001 — The phone is the source of truth

**Status:** accepted

## Context

The shop has patchy network. Billing cannot stop because a connection dropped,
and a customer standing at the counter will not wait for a retry.

## Decision

An encrypted SQLite database on the device is the source of truth. Any backend
added later is a sync target, never something the app reads through at bill time.

## Consequences

- Every feature must work offline. A feature that needs the network is a feature
  that needs a fallback.
- Data can be lost with the phone, so backup is a first-class feature, not a
  later addition. Android deletes an app's private storage on uninstall, so the
  backup has to be written into a user-granted folder that outlives the app.
- Multi-device support becomes a sync problem rather than a server problem. The
  schema carries `shopId`, `deviceId`, `updatedAt` and `deletedAt` from the
  first migration so that it stays possible.
