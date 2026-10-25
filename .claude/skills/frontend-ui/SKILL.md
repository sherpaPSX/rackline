---
name: frontend-ui
description: Build Rackline screens and controls in React with @rackline/ui-kit for desktop and phone, including real-time controls like faders, meters and EQ curves. Use when creating or changing anything in packages/ui or packages/ui-kit.
---

# Frontend UI

Before designing a new screen or flow, run the `dsp-ux` skill (analysis,
scenarios). This skill is about **building** it.

## Look and components

- Use only `@rackline/ui-kit` components and its design tokens (colors,
  spacing, type). No ad-hoc CSS colors or one-off components in `ui`; if
  something is missing, add it to `ui-kit` as a generic component.
- Dark theme first, high contrast, readable from a distance. Color carries
  meaning (link, band, state), never decoration.
- One module component everywhere, with a compact (2–4 key controls) and an
  expanded form. Every parameter has exactly one editor.

## Desktop and phone

- Same React code for both; layout adapts. The phone is not a shrunken
  desktop: it gets the tasks the plan assigns to it (see `docs/ui-plan.md`).
- Touch targets at least 44 px, no hover-only actions, no hidden gestures for
  important actions.
- The desktop UI must stay usable in half a screen next to a measurement app.

## Real-time controls

- State comes from the server over the WebSocket API (`@rackline/api`). The UI
  shows the value immediately while dragging (optimistic), sends throttled
  intents, and reconciles with the server broadcast.
- Show the value while dragging; double click = default; fine mode with a
  modifier or long press; direct number entry; correct units (dB, Hz, ms).
- No value changes from the scroll wheel unless the control has focus.
- Meters render with `requestAnimationFrame`, not React state per sample.
- EQ/crossover curves are computed from filter parameters on the client
  (generic biquad math in a `ui-kit` curve component, no RPM knowledge), so
  the curve follows the finger without a server round trip. Draw on canvas or
  SVG.

## Safety

- Mute is one click. Anything that causes an audio dropout (layout upload)
  needs a confirmation that says so.
- Undo is always available for value changes.
- Always visible: connection/sync state, meters/limit/clip, active noise,
  "changes not uploaded".

## Done

- Works at desktop width and phone width.
- Keyboard reachable, visible focus, labels for screen readers on controls.
- No direct imports from `protocol` or `model`.
