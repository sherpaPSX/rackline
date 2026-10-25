---
name: dsp-ux
description: Design, review and plan UX/UI for controlling DSP processors and live-sound tools for sound engineers. Use when designing a screen or feature, reviewing a prototype or wireframe, or planning the Rackline UI.
---

# UX design of DSP tools for sound engineers

The target user is a **sound engineer**, not a layperson. They understand
signal flow, crossovers, phase, PEQ and limiters. They don't need simplified
content; they need **speed, overview and confidence that nothing breaks**.
Drag Net is the cautionary example: it can do everything but is hard to use
even for pros. Ableton is the model: fully modular and still intuitive.

This skill is **a guide to thinking about the design**, not a finished
design. Concrete screens and views are decided in the project plan
(`docs/ui-plan.md`). Project specifics (hardware, its limits, the user's rig)
belong to **Project context** at the end, as facts, not decisions.

## Golden rule: analysis first, drawing second

The most common mistake is to start drawing and then pile idea on idea
without analysis. Therefore:

- **Don't draw a screen until steps 1 to 3 are done** and the user agreed.
- Every new idea (yours too) first goes into the **decision log** with the
  task it serves. An idea without a task goes to the **parking lot**. Draw
  only after a decision.
- When the user wants to draw right away, say which step is missing and offer
  to do it quickly (a short list is enough).

## Working artifacts

Keep them as files so they survive between sessions; update instead of
writing new ones:

1. **Situations**: table of situation, device, time per action, cost of error.
2. **Task inventory**: "the engineer wants …", with frequency, importance and
   situation.
3. **Object model and screen map**: a tree, not a mockup.
4. **Decision log**: decision, options, reason, date. Parking lot at the end.
5. **Scenarios**: 3 to 6 concrete step-by-step stories every design is tested
   against.

## Process

### 1. Situations
For a PA DSP typically:
- **Preparation** (home / warehouse): build the system, routing, crossovers,
  speaker presets. Calm, laptop, often offline.
- **Phasing and tuning on site** (before the show): with a measurement tool
  (Smaart, REW, Open Sound Meter). Fast iterations of delay / polarity / PEQ /
  crossover. Measurement on the same or next screen, engineer walks the room
  with a phone.
- **During the show**: quick change of anything, mostly level and mute, also
  PEQ or delay. Dark, under pressure, phone or laptop at the desk. Errors are
  heard immediately.

### 2. Task inventory
Sort tasks by frequency × importance per situation. Default list, adjust
with the user:

**Building the system**
- assign and name physical inputs/outputs (Mid-high L, Sub mono…)
- create lines: stereo/mono, L+R sum to sub, split a signal, send anywhere
- add, move, duplicate and remove modules
- choose a source (analog / AES / generator), backup source
- see DSP load and what still fits

**Tuning speakers and system**
- crossover (type, slope, frequency) together with the band's PEQ, and see
  the summed response of neighbouring bands
- separate **speaker PEQ** (speaker preset) from **system correction** (room,
  whole group)
- delay and polarity for alignment (sub ↔ tops, delay lines), fine steps,
  ms / m / samples, temperature for m ↔ ms
- limiters per speaker and amp (threshold, attack/release), possibly dBu/V
- gain structure: input trim, band levels, headroom
- mute/solo outputs while measuring; check polarity and wiring output by output
- pink noise / sine generator routed to chosen outputs
- copy settings between outputs / L↔R

**During the show**
- quick group level change (subs, tops, delay line), mute
- quick PEQ / delay change without losing overview
- meters, limit and clip of all outputs at a glance
- recall a scene / preset, A/B compare, undo
- protect against mistakes while keeping chosen controls live

**Management**
- save/load/copy speaker presets and the whole system, compare two states
- work offline and upload later, see device ↔ file differences
- know whether the device is connected and in sync

### 3. Information architecture
Before drawing a pixel, decide and log:
- **Main objects**: what the engineer works with in each situation and how
  they talk about it. The same data may have several natural views (signal
  path vs. speaker band). List them with the tasks they serve and log the
  decision on the primary view and transitions. The decision itself belongs
  to the plan, not this skill.
- **Levels of detail**: e.g. system overview, chain, module compact, module
  expanded. Each level has one purpose.
- **Always visible** (meters, connection, mute, limit) vs. on demand.
- **One place for one thing**: no parameter has two different editors. Other
  views may show it and link to it.
- **Desktop vs. phone**: which tasks on which device. The phone is not a
  shrunken desktop.

### 4. Scenarios and drawing
Write scenarios from the most important tasks, e.g.:
- "I phase the sub to the tops: select the sub, play noise, change delay in
  0.1 ms steps and watch the phase in Smaart."
- "During the show the sub starts booming around 60 Hz: I find the sub on the
  phone and pull the PEQ down."
- "I add a delay line: branch a new output from L+R, add delay and PEQ."

Then a rough wireframe; one pass through a scenario = a sequence of screens.
Count steps per scenario and note where one can get lost. Only when the
scenarios pass is the look tuned.

### How others solve it
For each concrete problem in steps 3 and 4 (stereo linking, EQ layers,
topology change during a show, phasing with a measurement tool), briefly say
how Ableton and system software (Compass, LA Network Manager, R1, ArmoníaPlus,
Lake, Q-SYS) solve it. Not a generic survey: an answer to the problem at
hand, with a source.

### 5. Plan
A document: decisions with reasons, screen map, tasks split into MVP / later,
open questions, technical limits (what the hardware can change live and what
needs a re-upload / dropout).

## Mental models of sound engineers

- **Signal flows one way** (left to right or top to bottom), like a channel
  strip or device chain. Input at the start, output at the end.
- **Module chain**: order on screen = processing order, drag to reorder.
- **Buses, sends, branches**: a signal is "sent" or "branched" (send, bus,
  matrix, parallel chain), not wired across a canvas. Free cable patching is
  unreadable beyond a few blocks.
- **Stereo is one thing**: an L/R line is edited once; single parameters can
  be unlinked (delay, trim).
- **A speaker band as a whole**: crossover + speaker PEQ + delay + polarity +
  limiter + level belong to one output (Lake, DLM, Galileo, amp presets).
- **Frequency graph** is the natural editor of crossover and PEQ: drag a
  point, wheel = Q/slope.
- **Physical controls**: fader, knob, mute, meter with clip LED. Units dB,
  Hz, ms, m, °, never internal values.

## Patterns to learn from

- **Ableton Live (main model)**: a module is set where it sits in the chain;
  add from a browser or by dragging; compact view with key controls and
  expand to detail; easy removal; racks with parallel chains; macros; sends
  and returns.
- **Digital consoles (X32/Wing, dLive, CL)**: channel strip, sends on fader,
  always-visible meters, scenes with recall filters.
- **System processors (Lake, Galileo/Compass, DLM, Q-SYS)**: speaker band as
  an object, layered EQ graph, output groups, speaker preset separate from
  system tuning, offline mode.
- **Measurement software (Smaart, OSM)**: the engineer watches measurements in
  parallel; the UI must allow changing one parameter without losing context
  and fit next to the measurement.

**Anti-pattern Drag Net**: free drawing of blocks and wires, editing in
separate windows, unclear where things are, many steps for simple things, no
overview of the whole system.

Don't copy blindly: Ableton is a desktop app with a mouse. On the phone keep
its principle (edit in context, compact/expanded module) but adapt the layout
to touch.

## Interaction principles

1. **Edit in context**: a parameter is edited where its module is visible in
   the path. No separate panel if avoidable.
2. **Progressive disclosure**: a compact module shows 2 to 4 key controls
   (limiter: threshold + GR meter), detail on expand.
3. **One screen, one task**: system overview, band tuning, show. Not
   everything at once.
4. **Safety during the show**: mute is fast, but deleting a module or changing
   topology needs confirmation. Undo always available. Actions that cause an
   audio dropout are clearly marked in advance.
5. **Immediate feedback**: meters, GR, sync state, value while dragging.
6. **Precision and speed**: drag for coarse, fine mode (modifier / long
   press), direct number entry, wheel, step per unit. Double click = default.
7. **Consistency**: the same control looks and behaves the same everywhere.
   Color has meaning (line, band, state), not decoration.
8. **Every element serves a task**: whatever serves no task in the inventory
   goes away or into detail.
9. **Readable on site**: dark theme, high contrast, large touch targets,
   readable from a distance.
10. **Honest about the hardware**: the UI doesn't promise a live change the
    DSP can't do; limits are visible in advance, not as an error.

## Review checklist

Mark each item ✓ / ✗ / ? with the exact place in the design. Walk the
scenarios first, then the checklist.

**Analysis**
- [ ] Do situations, task inventory and scenarios exist, and does the design
      follow from them?
- [ ] Does every screen have one task and every element a task from the
      inventory? (list elements without a task)

**Signal path**
- [ ] Is the flow from input to output visible at a glance?
- [ ] Is it clear what is stereo and mono, where the signal splits, merges and
      where it is sent?
- [ ] Is adding, moving and removing a module quick and without searching?

**Editing**
- [ ] Is a module edited in place, with compact and expanded modes?
- [ ] Does every parameter have only one editor?
- [ ] Are units, steps and fine control right for sound engineers?

**Show and safety**
- [ ] Do the "during the show" scenarios pass quickly, also on the phone?
- [ ] Are meters, limit, clip and mute visible without searching?
- [ ] Are destructive actions and audio dropouts protected and marked? Is
      there undo?
- [ ] Is connection and sync state visible?

**Visual noise**
- [ ] How many different panel types are visible at once? Can one go?
- [ ] Is the hierarchy clear, what is primary and secondary?
- [ ] Is any information repeated in several places?

**Before a screen is built** (hand-off to `frontend-ui`)
- [ ] The screen's scenarios are written in `docs/ui-plan.md` or linked.
- [ ] Each control maps to one parameter in the module registry.
- [ ] Desktop and phone behaviour are both decided (or phone explicitly later).

Review result: problems sorted by impact on scenarios, each with a proposed
fix. Don't add new features as fixes; new ideas go to the parking lot.

## How to use this skill

- **"Review the design"** → load the prototype and artifacts, walk the
  scenarios and the checklist, return a sorted list of problems. Don't draw a
  new design unless asked.
- **"Design screen / feature X"** → check steps 1 to 3 for X (ask for missing
  context), write a scenario, then a wireframe.
- **"Create a plan"** → document per step 5.
- **New idea** → decision log or parking lot, not straight into the design.
- **Ask like a sound engineer**: "What do I do when the sub starts booming
  during the show?" "How do I align the sub to the tops with a measurement
  mic?" Turn the answer into a task or scenario.
- Ask one to three questions at a time, not a long questionnaire.

## Project context (Rackline / Rane RPM 26z)

- The topology is compiled into the DSP; uploading a new topology = a short
  audio dropout. Module parameters, Matrix Mixer, Select 1 of N and mix
  levels can change live. Adding/removing a module is a topology change and
  the UI must say so.
- Limited DSP power (`docs/dsp-limits.md`): adding modules needs a load
  indicator. A 30-band GEQ doesn't fit next to a full PA system on RPM 26z.
- Lines are 1 (mono) or 2 (stereo) wide; a stereo module = 2 DSP instances
  edited together, with per-parameter unlink.
- Lukas's rig: 6 outputs (Mid-high R/L, Low-mid R/L, BassHorn mono, Subbass
  mono).
- References: `docs/ui-plan.md`, `docs/modules.md`, `docs/protocol.md`.
