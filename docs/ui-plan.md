# UI plan (summary)

Agreed with Lukas on 2026-10-24/25. This is the design target; the visual look
comes from `@rackline/ui-kit`. Process and review rules: `.claude/skills/dsp-ux`.

## Users and situations

Users are **sound engineers**, not laypeople. Drag Net is the anti-pattern
(can do everything, hard to use); Ableton Live is the model (fully modular,
still intuitive).

- **Preparation** (home/warehouse): build the system, routing, crossovers.
  Calm, laptop, often offline.
- **Tuning on site** (before the show): with a measurement tool (Smaart, REW,
  Open Sound Meter) next to the app, fast iterations of delay/polarity/PEQ.
- **During the show**: quick changes of anything, mostly levels and mute,
  also system EQ. Dark, under pressure. Topology is never changed live.

## Model

- **Rack** is the basic building block: a source (input / another rack /
  crossover band), stereo or mono (mono sums L+R), a chain of modules, outputs.
  Stereo L+R is linked; single parameters (delay, trim) can be unlinked.
- **Signal order = screen order** (top to bottom, left to right). No free canvas
  with wires.
- A crossover can only be the **last module of a rack**; its bands are the
  sources of the next racks. The RPM only has 2-way and 3-way crossovers, so a
  4-band crossover in the UI is a 3-way + 2-way cascade in the DSP.
- **One module component everywhere**, compact (2–4 key controls) and expanded
  in place. Every parameter has exactly one editor.
- Importing any Drag Net config: the block graph is cut into racks at splits and
  merges. Racks are only a view; import never rearranges the DSP. Blocks with
  control inputs (side-chain compressor, ducker, auto mixer, ANC) are read-only.

## Screens

1. **Show** (Provoz): fader + mute per rack and input, meters, limit/clip,
   system EQ as 9 octave faders 63 Hz–16 kHz with a response curve (a
   fixed-frequency 9-filter stereo PEQ in the DSP, see dsp-limits.md).
2. **System**: racks stacked, expandable in place, several open at once.
   - mode **Tune**: values only, pink-noise toggle per rack (several at once,
     a persistent "NOISE PLAYING → … · Stop" bar), undo.
   - mode **Edit layout**: insert (+ between modules), move (⋮⋮), new rack,
     rack source/outputs, DSP load, **Upload** with an audio-dropout warning.
3. **Files**: save/load the system, offline work, diff file ↔ device.

Always visible: connection and sync state, meters/limit/clip, active noise bar,
undo, "changes not uploaded".

## Decisions worth knowing

- No software show lock; OS lock screen is enough. Protection against mistakes
  = undo + no value changes by scroll wheel without focus.
- New band racks start from a default module set (speaker PEQ, delay,
  polarity, limiter, level), editable and savable as a template.
- The app saves DSP itself: band fader = Output Trim, system delay is added to
  every band delay.
- Phone UI is designed last; the phone is not a shrunken desktop.

## Parked ideas (after MVP)

Custom phone control panels for operators, automatic delay alignment with a
measurement mic, RTA spectrum behind the EQ curve (needs a sound card; the RPM
sends no spectrum).

## Open

- Supported models: RPM 26z first; RPM 88/44/22/2 later?
- Phone access over Wi-Fi: who on the network may connect.
