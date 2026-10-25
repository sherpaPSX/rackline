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
  and a captured RPM26z_01 TFTP config. Modules missing from them (GEQ, matrix
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
