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
| 30-Band Graphic EQ | quick room correction | yes (but see dsp-limits.md) | no |
| 2-way / 3-way crossover | LR / Butterworth / Bessel | yes | yes |
| Delay | max 1365 ms, step 1/48 ms | yes | yes |
| Level | level with min/max range | yes | yes |
| Limiter | speaker protection | yes | yes |
| Compressor | compression | yes | yes |
| Mono / Stereo S-C Compressor | side-chain compression (ducking) | optional | no |
| AGC | automatic gain control | installs | no |
| Ambient Noise Comp | level follows room noise, needs a sense mic | installs | no |
| Feedback Suppressor | automatic feedback suppression | mics | no |

## Routing

| Module | Purpose | Mapped |
|---|---|---|
| Mix N × 1 | sum several signals (e.g. L+R to mono sub) | 2×1 yes |
| Matrix Mixer | any input to any output with a level at each point | no |
| Select 1 of N | source switch (e.g. analog / AES) | no |
| Auto Mixer / Ducker | automatic mic mixing, music ducking | no |

Splitting one signal to several blocks needs no module: one output can feed
several inputs.

## Other

| Module | Purpose | Mapped |
|---|---|---|
| Signal Generator | pink noise / sine for tuning | yes |
| Meter | metering point anywhere in the chain | no |
| Label | Drag Net annotation only | – |
| Preset Recall, VIP/VOP | presets and external contact control | presets yes |

Wiring is fixed at compile time. Live routing changes are only possible via
modules that expose routing as parameters: Matrix Mixer, Select 1 of N and
Mix N×1 levels.
