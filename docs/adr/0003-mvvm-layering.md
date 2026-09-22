# ADR 0003 — MVVM with an enforced dependency rule

**Status:** accepted

## Context

The app needs to stay testable without a device, and the storage and UI choices
made now (Drizzle, expo-sqlite, Expo Router) should not be load-bearing for the
business rules.

## Decision

Four layers, with dependencies pointing inwards only:

| Layer     | Folder                                   | May import              |
| --------- | ---------------------------------------- | ----------------------- |
| Model     | `src/core`, `src/models`, `src/services` | nothing but itself      |
| Data      | `src/data`                               | Model, Drizzle, Expo    |
| ViewModel | `src/viewmodels`                         | Model ports, React      |
| View      | `src/views`, `app`                       | ViewModel, React Native |

The inner layers are framework-free. `src/services/ports.ts` declares the
interfaces; `src/data` implements them; `src/di/container.ts` is the only place
that knows which implementation is used.

The rule is enforced by `no-restricted-imports` in `eslint.config.js` and runs
in CI, because a rule that depends on discipline is a rule that erodes.

## Consequences

- A ViewModel can be tested against an in-memory repository with no database.
- Swapping `expo-sqlite` for `op-sqlite`, or `expo-print` for another renderer,
  touches `src/data` only.
- Views hold no business logic and no formatting decisions of their own.
