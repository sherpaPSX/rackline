# DSP limits: RPM 26z (and RPM 88)

Measured 2026-10-25 in Drag Net 4.2 under Wine (Resource window, "DSP usage"
and "Delay blocks") on script-generated configurations; limits from the Drag
Net help. Not verified on hardware, but DSP usage is computed by the Drag Net
compiler, which the hardware also uses.

## Hard limits

| Limit | RPM 26z | RPM 88 |
|---|---|---|
| DSP power | 100 % (several chips; a block cannot span chips) | about 1.65× the 26z |
| Delay blocks | **max 10**, 5 s total | max 20, 10 s total |
| Delay per block | 500 ms (longer = several blocks in series), step 1/48 ms | 500 ms |
| Filters in one PEQ | 1 to 15, cannot be added/removed live | same |
| Crossovers | 2-way and 3-way only | same |
| Presets | 24 | 24 |
| Config > 100 % | Drag Net saves it but cannot upload it | same |

DSP usage is the sum over several chips. When no chip has room for another
block, the meter jumps above 100 % even if "free" capacity remains, so block
costs don't add up exactly and wiring matters (a wired block costs more than
an unwired one).

## Approximate module cost on RPM 26z

Average of 4 unwired copies in an empty configuration. Wired blocks cost about
20–30 % more.

| Module | DSP |
|---|---|
| **30-band graphic EQ (1 channel)** | **≈ 29.5 %** |
| Parametric, n filters | ≈ 1.2 % + 0.55 % per filter (4: 3.5 %, 9: 6.3 %, 15: 9.5 %) |
| 3-way crossover | ≈ 8.3 % |
| 2-way crossover | ≈ 4.8 % |
| Signal generator | ≈ 4 % |
| Compressor | ≈ 3 % |
| Limiter | ≈ 2.3 % |
| Delay | ≈ 2 % (+ 1 of 10 delay blocks) |
| Level | ≈ 1 % |
| Mix 2×1, Select 2 | ≈ 0.5 % |

On RPM 88 one GEQ costs ≈ 18 % (4 GEQ = 71 %, 6 GEQ = 107 %).

## Lukas's system on RPM 26z

Analog L/R → Limiter → [system EQ] → [Delay] → 3-way (highs, mids, lows);
lows L+R → Mix 2×1 → 2-way (BassHorn, Subbass), i.e. a 4-band crossover as a
3-way + 2-way cascade. Six bands, each PEQ → Delay → Limiter → [Level] → output.

| Variant | DSP | Delay blocks | Fits? |
|---|---|---|---|
| Current config (PSX_RCF_FINAL) | 97 % | 7 of 10 | yes, barely |
| Plan without system EQ, band PEQs 4 filters | 91 % | 8 | yes |
| + stereo system PEQ 4 filters | 99 % | 8 | just |
| + stereo system PEQ 6 filters | 102 % | 8 | **no** |
| **+ stereo 30-band GEQ** | **149 %** | 8 | **no** |
| Lean: no Level blocks (use Output Trim), system delay folded into band delays | 79 % | 6 | yes |
| Lean + stereo system PEQ 9 filters | 93 % | 6 | yes |
| Lean + stereo system PEQ 15 filters | 101 % | 6 | **no** |

## Consequences for the app

1. A 30-band GEQ does not fit next to this system on RPM 26z. The system EQ
   (faders + curve in the UI) is implemented as a **fixed-frequency PEQ**
   (e.g. 9 octave bands): looks like a GEQ, costs 6 % instead of 30 %.
2. The app can save DSP itself: band fader = Output Trim (not a Level block);
   system delay = added to each band's delay (UI still shows one system delay).
3. Load indicator: **DSP %** and **delay blocks X of 10**, plus PEQ filter
   count (max 15). Exact DSP % only comes from the compiler; before that show
   an estimate from the table above with a margin.
4. Adding a module must check the limit up front (grey out modules that won't
   fit) and warn that PEQ filter count can't change live.
