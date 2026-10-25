---
name: code-quality
description: TypeScript, testing and PR rules for Rackline. Use when writing or reviewing any code in packages/, before opening a PR, or when unsure how to structure, test or name something.
---

# Code quality

## TypeScript

- Strict mode as configured; no `any`, no non-null `!` unless proven by a
  check right above. Prefer `unknown` + narrowing.
- Validate everything that crosses a boundary: WebSocket messages (zod in
  `api`), files read from disk, bytes from the network (length and ranges
  before indexing).
- Model domain values with types: `Db`, `Hz`, `Ms` branded numbers, block
  types as literal unions from the registry. Conversions raw ↔ engineering
  value live in one place (`model` registry).
- Small pure functions; side effects only in `server` and `desktop`.
- Errors: return typed results for expected failures (timeout, device
  unreachable, bad file); throw only for programmer errors.
- Names say what the sound engineer would say: `delayMs`, `crossoverBand`,
  not `val2`.

## Network robustness (server)

- Every request has a timeout and a bounded retry, like Drag Net.
- The device can disappear at any time (cable, power). Show "device
  unreachable", keep UI state, reconnect and re-read; never assume the last
  written value stuck without a reply.
- Throttle continuous controls: send the latest fader value at most every
  ~30 ms, always send the final value.
- Never block the event loop; no sync file or network calls.

## Tests

- Phase 1: unit tests only (Vitest), next to the code (`*.test.ts`) or in
  `test/`.
- In `protocol` and `model` write the test **first**, from a real sample:
  captured bytes, `.r26`, simulator log. Assert exact bytes for encoders.
- Round trips: decode(encode(x)) = x, and parse(file) → serialize = same bytes.
- No network or timers in unit tests; inject clocks and sockets in `server`.
- Never skip or weaken a test to get green.

## PRs

- One topic per PR, small enough to review in a few minutes.
- `pnpm check` green locally, then `/code-review` and `/simplify`.
- Description: what changed, why, how it was verified (unit test, simulator,
  Drag Net under Wine), what is still unverified on hardware.
- Commit messages in English, imperative ("Add PEQ band decoding").
