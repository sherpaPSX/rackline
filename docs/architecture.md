# Architecture

Decisions agreed on 2026-10-25. Changing any of them is a deliberate decision:
update this file in the same PR.

## Product

- Public name **Rackline**. Never call the app "Drag Net" (Rane trademark);
  "for Rane RPM" only describes compatibility.
- Public repo, MIT license, not monetized. Everything in English: code,
  comments, docs, UI texts.
- Platforms: **macOS and Windows**. No Linux builds.

## Phases

1. **Tune values of an existing setup** (faders, mute, PEQ, delay, limiters,
   crossovers, presets, meters). The setup is read from the device (TFTP) or a
   `.r26` file. Needs no DSP compiler. Must work on macOS and Windows.
2. **Edit the setup** (add/move/remove modules and racks). Needs the Drag Net
   DSP compiler, see [Compiler](#dsp-compiler-phase-2).
3. **Phone remote**: the UI served to a phone browser on the LAN.

## Processes

```
 RPM ──UDP 5131/5000, TFTP 69──  core (Node, Electron main or standalone)
                                   │  single source of truth for device state
                                   │  WebSocket API (@rackline/api)
                        ┌──────────┴──────────┐
                 desktop window          phone browser (phase 3)
                 (@rackline/ui)          (@rackline/ui, same code)
```

- The **core** owns the only true copy of device state and is the only thing
  that talks to the RPM.
- Desktop and phone are **two clients of the same WebSocket API**. No
  Electron IPC for data. Every change is broadcast to all clients, so a fader
  moved on the phone moves on the desktop too.
- Until phase 3 the WebSocket server binds to localhost only. Opening it to the
  LAN (and authenticating phones) is designed together with the phone remote.
- The core never changes the DSP layout on its own. A layout upload causes an
  audio dropout and only happens on an explicit user action.

## Packages (pnpm monorepo)

| Package | Responsibility | May import |
|---|---|---|
| `@rackline/protocol` | discovery, parameter frames, TFTP, config file parsing; pure TS, no I/O policy | nothing |
| `@rackline/model` | Drag Net block graph ↔ racks, module registry, value conversions, DSP load estimate | `protocol` |
| `@rackline/api` | WebSocket message contract as zod schemas, shared by server and UI | nothing (zod) |
| `@rackline/server` | device state, discovery loop, WebSocket server; runs without Electron | `api`, `model`, `protocol` |
| `@rackline/ui-kit` | Rackline UI component library (React) | nothing |
| `@rackline/ui` | React app for desktop and phone | `api`, `ui-kit` |
| `@rackline/desktop` | thin Electron shell: starts the server, opens the window | `server` |
| `tools/sim` | Python fake RPM for development without hardware | – |

Boundaries are enforced by `no-restricted-imports` rules in
`eslint.config.js`, so a violation fails CI. Adding a DSP module type means
adding one entry to the module registry in `model`, not edits across packages.

## Rack import (`@rackline/model`)

`buildRacks(blockTable)` turns any Drag Net block graph into racks without
touching the DSP:

- A rack is a linear chain. The graph is cut where a signal splits (one
  output feeds several blocks) or merges (a mixer: the mixer heads the rack
  and its inputs are the rack's sources).
- A crossover ends a rack; each band is a source for further racks. A
  crossover band feeding only another crossover (3-way → 2-way) is shown as
  one crossover with all bands.
- Two racks with the same module types whose sources are a left/right pair
  (inputs 1/2 or A/B, or the two channels of a stereo rack) become one stereo
  rack. A mono rack summing both channels of a stereo rack is the "mono" mode.
- Outputs belong to the rack whose end feeds them; an output fed straight
  from an input or a band gets a rack without modules.
- Rack names are suggested from block names (output names first).
- Blocks of unknown type stay in the chain as modules; side-chain inputs etc.
  are not handled yet (no sample).

## WebSocket API (`@rackline/api`)

Every message is JSON validated by a zod schema on both sides
(`parseClientMessage`, `parseServerMessage`).

- On connect the core sends `hello` (with `apiVersion`) and then `state`: the
  whole `AppState` (connection, found devices, the setup with its racks and a
  description of every module used, and all parameter values).
- Clients send intents: `setParam`, `recallPreset`, `discover`, `connect`,
  `disconnect`, `openProject` (an `.r26` without a device). The core applies
  them and broadcasts the result to all clients: `param` for one value,
  `state` when many values or the setup change, `connection`, `devices`,
  `error`.
- Values are in engineering units (dB, Hz, ms, octaves). For `steps`
  parameters (attack, release, ratio) the value is the index into the
  module's step list; ∞ travels as `"inf"`. Enum values are option codes.
- There is no message that changes the DSP layout or the device's network
  settings.

## Core (`@rackline/server`)

- `Core` holds the state and applies intents. It talks to the device through
  a small `Device` interface (`openRpm` on real sockets, an in-memory fake in
  tests).
- **Connect:** read device info, download the configuration over TFTP, build
  racks, read every known parameter of every block and the current preset.
- **Set a parameter:** the value is rounded and clamped by the registry,
  broadcast at once and written to the device at most every 30 ms per
  parameter (the last value always goes out). A failed write marks the device
  unreachable; the next reload corrects any value that did not stick.
- **Recall a preset:** write `04 01 fc00`, then read all values back. With an
  `.r26` open and no device, the file's preset values are applied instead.
- **Liveness:** every 2 s the core reads the current preset. No reply →
  `unreachable` (state kept); first reply after that → full reload; a preset
  changed elsewhere → values re-read.
- `ControlClient` refuses every system-object write except the preset
  recall, so network settings (`fe03`) cannot be written from the core.
- Not yet: meters, storing presets, saving `.r26` files.

## UI client (`@rackline/ui`)

- `CoreClient` keeps the `AppState` in sync over the WebSocket API and
  reconnects every second when the core goes away.
- Edits are **optimistic**: the value is rounded and clamped like the core
  stores it, shown at once and sent as `setParam`. The core echoes every
  stored value; echoes of values this window sent are dropped while a newer
  local value is on its way, so a dragged fader never jumps back. Any other
  broadcast (another window, the device) wins.
- **Undo/redo** covers value changes made in this window. One drag of one
  control (moves less than 1 s apart) and a linked L+R edit are one step.
  A new `state` (new setup, preset recall) clears the history.
- View helpers (`racks.ts`) derive band strips, input pairs and rack detail
  lines from the API's JSON only.

## Tooling

- TypeScript (strict), pnpm workspaces, ESLint (typescript-eslint strict), Vitest.
- Desktop build: electron-vite; installers: electron-builder (`.dmg`, `.exe`).
  Added together with the first desktop feature.
- Installers are unsigned for now, no auto-update. Signing and GitHub Releases
  auto-update get switched on once other people use the app.
- Network permissions to expect: macOS "Local Network" prompt, Windows
  firewall prompt for UDP.

## Testing

- Phase 1: **unit tests only** (Vitest), mainly `protocol` and `model`.
  No E2E / Playwright yet.
- Fixtures are real files: Lukas's `PSX_RCF_FINAL.r26` (his actual RCF rig)
  and a captured RPM26z_01 TFTP config, cut after the block table so no
  compiler-generated DSP code is committed. They live in
  `packages/protocol/test/fixtures/` (see its README). Modules missing from them (GEQ, matrix
  mixer, select, compressor, generator, digital inputs) get small fixtures made
  in Drag Net under Wine when needed.
- The Python simulator and Drag Net under Wine are for manual verification.
- The protocol is verified against the simulator only. When hardware is
  available, run the hardware checklist (to be written in `docs/`).

## CI and workflow

- GitHub Actions on every PR: typecheck, lint, unit tests (Linux).
- Installers (macOS + Windows) are built when a `v*` tag is pushed. Added with
  the desktop package.
- **No direct commits to `master`.** Small PRs, squash-merged once CI is
  green. Lukas is asked to review only changes to the protocol, the DSP layout
  logic or the look of the app.

## DSP compiler (phase 2)

- Drag Net is no longer offered for download (support ended 2017-06-01).
  The decision is to ship `compilerdll.dll` with the app despite the risk.
- The DLL lives in a separate repo (`rackline-compiler-bin`, release asset)
  and is pulled in at build time, so a takedown request affects only that file.
  **Never commit it to this repo.**
- Windows: run it in a small 32-bit helper process. macOS: run it in a built-in
  x86 emulator (to be verified: the DLL must not depend on Windows APIs beyond
  what we can stub).
- Calling convention and buffer sizes: [compiler.md](compiler.md).
