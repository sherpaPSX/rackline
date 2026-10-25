---
name: architecture-guard
description: Keep Rackline modular - package boundaries, where new code belongs, the module registry and the WebSocket API contract. Use before adding a package, a dependency, a DSP module type, an API message or any code that crosses packages.
---

# Architecture guard

Read `docs/architecture.md` first. This skill decides **where code goes** and
what may depend on what.

## Dependency direction

```
protocol      api        ui-kit
   ↑        ↗   ↖          ↑
 model    /       \        |
   ↑     /         \       |
 server ─┘          ui ────┘
   ↑
 desktop
```

- `protocol`: bytes in, bytes out. No sockets, timers, files, Electron or React.
- `model`: pure domain logic (block graph ↔ racks, conversions, DSP estimate).
  No I/O.
- `api`: zod schemas and inferred types for every WebSocket message. No logic.
- `server`: the only place with device state, sockets, timers and retries.
  Runs under plain Node (no Electron imports).
- `ui`: React. Talks to the core **only** through `api` messages over
  WebSocket. Never imports `protocol` or `model`; if the UI needs a value
  computed by them, the server sends it.
- `ui-kit`: presentational components only, no knowledge of RPM or racks.
- `desktop`: starts the server and opens a window. Keep it tiny.

ESLint enforces these imports. Also add the dependency to the package's
`package.json` and the TS project reference. Never bypass with relative paths
into another package.

## Where does it go?

| Change | Package |
|---|---|
| New byte layout, record type, TFTP detail | `protocol` |
| New DSP block type, its parameters, conversions | `model` registry |
| Rack import rules, DSP load estimate | `model` |
| New thing the UI can ask for or be told | `api` schema, then `server` handler, then `ui` |
| Polling, retries, discovery loop, reconnect | `server` |
| Generic control (fader, knob, meter) | `ui-kit` |
| A screen or a module's editor | `ui` |

## Module registry

Each DSP block type is **one entry** (one file) in the `model` registry:
btype, name, parameters (index, size, conversion, unit, range, default), and
its compact controls (2–4 key parameters). Everything else (decoding, UI
generation, presets) reads the registry. Adding a module type must not require
edits elsewhere; if it does, fix the design, not the symptom.

## WebSocket API

- Every message is a zod schema in `api`; server and UI both validate.
- The server is authoritative: the UI sends intents (`setParam`), the server
  applies them and broadcasts the resulting state to all clients.
- Version the protocol between core and clients (`apiVersion` in the hello
  message) so a cached phone page can tell it is outdated.
- Localhost-only until the phone phase.

## Red flags

- A package importing something "just for a type" from a forbidden package.
- State held in the UI that the server doesn't know about (except pure view
  state like which rack is expanded).
- Electron APIs outside `desktop`.
- A switch over block types outside the registry.
