# RPM 26z modules

From the Drag Net 4.2 palette for RPM 26z. "Mapped" = parameters known for our UI.

## Fixed I/O

| Module | Purpose | Mapped |
|---|---|---|
| Analog Input 1, 2 | sensitivity Pro / Consumer / User, trim, mute | yes |
| Digital Input A, B (AES3) | digital stereo input (A = L, B = R), trim, mute | yes |
| Output 1–6 | analog outputs, trim, mute, polarity | yes |

## Processing

| Module | Purpose | For PA | Mapped |
|---|---|---|---|
| Parametric (1–9+ bands) | PEQ: Band, Low/High Shelf, High Cut, Horn EQ, All-Pass | yes | 9-band yes, other sizes share the layout |
| 30-Band Graphic EQ | quick room correction | yes (but see dsp-limits.md) | yes (high cut unknown) |
| 2-way / 3-way crossover | LR / Butterworth / Bessel | yes | yes |
| Delay | max 1365 ms, step 1/48 ms | yes | yes |
| Level | level with min/max range | yes | yes |
| Limiter | speaker protection | yes | yes |
| Compressor | compression | yes | yes |
| Mono / Stereo S-C Compressor | side-chain compression (ducking) | optional | yes |
| AGC | automatic gain control | installs | yes (max/min gain not found) |
| Ambient Noise Comp | level follows room noise, needs a sense mic | installs | yes |
| Feedback Suppressor | automatic feedback suppression | mics | 15 bands (ranges partly unverified) |

## Routing

| Module | Purpose | Mapped |
|---|---|---|
| Mix N × 1 | sum several signals (e.g. L+R to mono sub) | yes (2–10) |
| Matrix Mixer | any input to any output with a level at each point | 2×2, 6×6 (other sizes: block type unknown) |
| Select 1 of N | source switch (e.g. analog / AES) | yes (2–10) |
| Auto Mixer / Ducker | automatic mic mixing, music ducking | 4×4 (detect mode not decoded) |

Splitting one signal to several blocks needs no module: one output can feed
several inputs.

## Other

| Module | Purpose | Mapped |
|---|---|---|
| Signal Generator | pink noise / sine for tuning | yes |
| Meter | metering point anywhere in the chain | yes (no parameters) |
| Label | Drag Net annotation only | – |
| Preset Recall, VIP/VOP | presets and external contact control | presets yes |

Wiring is fixed at compile time. Live routing changes are only possible via
modules that expose routing as parameters: Matrix Mixer, Select 1 of N and
Mix N×1 levels.

## Not yet mapped: what the Drag Net help says

Parameter names and ranges from the Drag Net 4.2 help (read locally, not
committed), to guide mapping with the simulator. Block types come
from Drag Net's palette (saved configurations).

| Module | Block type | Parameters (range, step) |
|---|---|---|
| Mix N × 1 (2–10 inputs) | 0x0200 + N − 2 | input level −30 … 0 dB, output level −30 … +16 dB (½ dB), mute per input and output |
| Select 1 of N (2–10 inputs) | 0x0210 + N − 2 | selected input |
| Matrix Mixer (2, 4, 6, 8, 10 square) | 0x0801 (2 × 2), 0x0817 (6 × 6) | crosspoint on/off and level −30 … 0 dB, input level −60 … 0 dB, output level −30 … +16 dB (½ dB), mute, solo, invert per input/output |
| Auto Mixer / Ducker (2–8 in × 2–8 out) | 0x0b0c (4 × 4) | detect threshold −70 … −12 dBFS, ducker depth 0 … 80 dB, gate depth 0 … −95 dBFS or off, priority 1 … 8, forced on, last on |
| Feedback Suppressor (5, 10, 15 bands) | 0x0a01 (15) | fixed and floating filters, sensitivity, gain margin, auto setup, built-in limiter −60 … 0 dBFS |
| Meter | 0x0400 | none (metering point) |

Limiter attack and release use the same tables as the compressor (0.5 … 100
ms, 1 ms … 5 s). Delay: up to 5 s per configuration, 500 ms per delay block.
