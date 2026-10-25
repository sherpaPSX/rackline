---
name: rpm-protocol
description: Add, decode or change Rane RPM protocol support in Rackline - a module parameter, a new block type, a system object, meters, discovery or TFTP. Use whenever packages/protocol or the module registry in packages/model changes.
---

# Working on the RPM protocol

The protocol was reverse engineered from Drag Net and is verified **only
against the simulator**. Treat every new fact as a hypothesis until a test on a
real sample backs it.

## Sources of truth (in this order)

1. Real samples in `packages/*/test/fixtures/` (captured TFTP config,
   Lukas's `.r26`, simulator logs).
2. `docs/protocol.md` (wire format, conversions, indexes).
3. `docs/rpm26z-modules.json` (machine-readable parameter map).
4. `tools/sim/parse_cfg.py` (reference parser for the config block table).

If they disagree, stop and report the conflict instead of picking one.

## Add or decode a module parameter

1. Find the block type (`btype`) in `docs/protocol.md` / `rpm26z-modules.json`.
   If the type is unknown, get a sample: build a tiny config with that one
   module in Drag Net under Wine (see `rpm-simulator`) and capture the TFTP
   upload and the parameter writes in the simulator log.
2. Find the index by changing one value in Drag Net and reading which record
   it writes (`setval` workflow in `rpm-simulator`). Note size and raw range.
3. Derive the conversion (raw ↔ dB/Hz/ms/enum). Check it at both ends of the
   range and one value in the middle.
4. **Write the test first** in `packages/protocol` or `packages/model`:
   encode a record and compare with captured bytes; decode captured bytes to
   the expected engineering value.
5. Add the parameter to the module registry in `model` (one entry per block
   type, see `architecture-guard`) and to `rpm26z-modules.json`.
6. Update `docs/protocol.md` (index table, conversions). Mark it
   "verified with simulator" or "guessed".

## Rules

- Frames are always 905 bytes, max 64 records, big-endian. Discovery packets
  are always 82 bytes.
- `protocol` is pure: no sockets, timers or global state. It builds and
  parses bytes. I/O, retries and timeouts live in `server`.
- Retries: Drag Net resends when a reply is missing; match replies on source
  IP and the words at frame offsets 9, 11, 13.
- Dangerous writes: `04 13 fe03` (network settings), `WI` (set IP),
  `04 05 fe00` (transfer start/end), preset store. Never send them from tests
  or tooling without an explicit user action.
- Block idx 0 is the preset tag of every block; do not treat it as a value.
- Meters are indexes from 0x8000, 1 byte, dB below full scale.
- Never paste disassembly or code from Rane binaries into the repo; describe
  the behaviour in your own words.
