# Rackline

Unofficial desktop controller for Rane RPM DSP processors (RPM 26z first).
Electron + TypeScript + React, pnpm monorepo. The core (Node) talks to the RPM
over UDP/TFTP and serves one WebSocket API to the desktop window and (later)
the phone browser.

Read before larger changes: `docs/architecture.md` (decisions, package map),
`docs/protocol.md` (wire format), `docs/ui-plan.md` (what the UI must do).

## Commands

```sh
pnpm install
pnpm check          # typecheck + lint + test; must pass before every PR
pnpm test:watch
python3 -I tools/sim/fake_rpm.py   # fake RPM 26z, see tools/sim/README.md
```

## Packages and boundaries

`protocol` → nothing · `model` → protocol · `api` → nothing ·
`server` → api, model, protocol · `ui-kit` → nothing · `ui` → api, ui-kit ·
`desktop` → server. Enforced by ESLint (`eslint.config.js`). `ui` never imports
`protocol` or `model`; it only knows the WebSocket API. Details: the
`architecture-guard` skill.

## Hard rules

- **Never commit anything from Rane**: Drag Net installers, `compilerdll.dll`,
  other binaries or extracted code. The compiler lives in a separate repo
  (`rackline-compiler-bin`). Never call the app "Drag Net".
- **The protocol is verified only against the simulator.** Every change to
  `protocol` needs a unit test on a real sample (fixture) and a matching
  update of `docs/protocol.md`. Mark anything guessed as unverified.
- **The core never changes the DSP layout on its own.** A layout upload causes
  an audio dropout and only happens after an explicit user confirmation.
- Never write `04 13 fe03` (network settings) or `WI` (set IP) without explicit
  user action: a mistake makes the device unreachable.
- All code, comments, docs and UI text in English.

## Workflow

- No direct commits to `master`. Small PRs; squash-merge when CI is green.
- Ask Lukas to review only changes to the protocol, DSP layout logic or the
  look of the app.
- Before opening a PR run `/code-review` and `/simplify`.

## Definition of done

- [ ] `pnpm check` passes
- [ ] New logic in `protocol`/`model` has unit tests (tests first there)
- [ ] Docs updated (`docs/protocol.md`, `docs/architecture.md`, module map)
- [ ] No Rane files, no secrets, no `any`
- [ ] PR description says what changed and what is still unverified on hardware

## Skills

`.claude/skills/`: `rpm-protocol` (add/decode module parameters),
`rpm-simulator` (fake RPM and Drag Net under Wine), `dsp-ux` (UX for sound
engineers, review checklist), `frontend-ui` (screens with ui-kit),
`architecture-guard` (package boundaries, module registry), `code-quality`
(TypeScript and testing rules).
