# Rane RPM network protocol (Drag Net 4.2)

State as of 2026-10-24. Read from the code of RaneSock.exe and DragNet.exe and
verified against a simulator that the original Drag Net (under Wine) treats as
a real RPM 26z. **Not yet verified on real hardware.**

Machine-readable parameter map: [rpm26z-modules.json](rpm26z-modules.json).

## Ports

| Port | Protocol | Purpose |
|---|---|---|
| UDP 5131 (device) / 5132 (PC) | 82-byte packets | discovery, MAC, set IP |
| UDP 5000 | 905-byte frames | read and write parameters |
| UDP 69 | TFTP (octet) | upload / download the whole configuration (file `file`) |

## 1. Discovery and IP (plug-and-play)

All packets are 82 bytes; the first two are an ASCII command, the rest zero
unless stated otherwise.

- **`RA` – find all devices:** broadcast to `255.255.255.255:5131`
  (SO_BROADCAST); replies arrive on UDP 5132 on the PC. Reply: `[2..5]` device
  IP, `[6..11]` MAC.
- **`RM` – get MAC:** to `IP:5131`, reply on 5132 with the same layout.
- **`WI` – set IP:** broadcast to `255.255.255.255:5131`. `[0..1]='WI'`,
  `[2..5]` new IP, `[6..11]` MAC of the target device (from the RA reply),
  `[12..15]` netmask (big-endian).

The broadcast works even when the RPM is in another subnet. Plug-and-play:
send RA → for every device outside the PC's subnet send WI with a free address
in the PC's subnet. Factory default IP is 192.168.69.22; the device supports
static IP only.

Code: `encodeFindAll`, `encodeGetMac`, `encodeSetIp`, `decodeDiscoveryReply`
in `@rackline/protocol`. The reply layout is verified with the simulator
(Drag Net accepts it); `WI` is encoded from Drag Net's code and unverified.

## 2. Parameter frames (UDP 5000)

A frame is always 905 bytes:

| Offset | Meaning |
|---|---|
| 0 | 0 = read, 1 = write, 2 = device reply |
| 1..2 | status in reply (0 = OK) |
| 8 | record count N (max 64) |
| 9 + 14·i | record i |

Record (14 bytes, big-endian):

| Byte | Meaning |
|---|---|
| 0 | 0x00 = DSP block parameter, 0x04 = system object |
| 1 | block instance ID (subtype for system objects) |
| 2..3 | block type / object ID |
| 4..5 | parameter index |
| 6..7 | 0 |
| 8..9 | value size in bytes (1, 2 or 4) |
| 10..13 | value (right-aligned) |

The reply is a copy of the request with `[0]=2` and values filled in. Drag Net
retries when no reply arrives. Replies are matched on source IP and the words
at frame offsets 9, 11 and 13. Bytes 3..7 of a frame are 0 in every sample; their
meaning is unknown.

Code: `encodeFrame` / `decodeFrame` / `isReplyTo` in `@rackline/protocol`,
`deviceInfoReadRecords` / `decodeDeviceInfo` for the system objects below.

### System objects (verified)

| Record | Meaning |
|---|---|
| `04 11 fb05` idx 0 | firmware version: major×10 (25 → 2.5) |
| `04 11 fb05` idx 2 | type: 0x00 RPM 88, 0x20 RPM 22, 0x40 RPM 44, **0x60 RPM 26z**, 0x80 RPM 2, 0xA0 RPM 2m |
| `04 11 fb05` idx 3 | firmware version: minor (3 → 2.5.3) |
| `04 08 fc01` idx 0..7 | device name, 8×4 bytes ASCII |
| `04 01 fc00` idx 0 | **current preset; writing it recalls the preset** |
| `04 13 fe03` idx 0..7 | network settings (writing overwrites IP/mask, careful) |

### Meters (verified with the simulator)

Meters are read as block parameters with index from 0x8000 (size 1 byte).
Drag Net polls them several times per second.

| Meter | Record |
|---|---|
| Analog input (dBu) | `00 <id> 0105` idx 0x8000 |
| Input after A/D (dBFS) | `00 <id> 0105` idx 0x8001 |
| Digital input AES3 (dBFS) | `00 <id> 0103` idx 0x8000 |
| Analog output (dBu) | `00 <id> 0106` idx 0x8002 |
| Output before D/A (dBFS) | `00 <id> 0106` idx 0x8001 |
| Compressor gain reduction (dB) | `00 <id> 0500` idx 0x8000 |

The value is the distance from maximum in dB: 0 = full scale (+24 dBu for
analog, 0 dBFS for converters), 10 = 10 dB below. Drag Net's meter shows about
64 dB of range. For gain reduction the value is the dB of reduction directly.
The 1 dB step is an estimate from the meter drawing; verify on hardware.

### Presets

The device has 24 unnamed presets (names exist only in the Drag Net project).

- **Recall:** write `04 01 fc00` idx 0 = preset number.
- **Store current state to preset N:** 1) write idx 0 = 0 to all blocks (and
  `04 4x e002` idx 0 = 0 for VIP pins), 2) write idx 0 = N to blocks that
  belong to the preset, 3) write `04 07 fe01` idx 0 = N ("store"), 4) write
  `04 01 fc00` idx 0 = N.
- So idx 0 of every block is its "preset tag".

### Other system objects (meaning unclear)

`04 40..47 e002` (8 VIP remote-control pins), `04 50..57 e003`,
`04 80..87 e001`, `04 03 fc03`, `04 09 fc04` (idx 0–0x51), `04 15 fc05`,
`04 16 fc06`, `04 17 fc07` (64 items), `04 10 fb03`, `04 05 fe00`. They relate
to remote control (VIP/VOP, Smart Remotes) and are not needed for our UI.

## 3. Configuration and module mapping

The whole configuration (blocks, wiring, presets) is transferred as one file
over TFTP (`WRQ`/`RRQ` name `file`, mode `octet`; the device replies from
port 69). Blocks are 512 bytes; a shorter (possibly empty) block ends
the file (RFC 1350). Rackline implements only the download (`TftpDownload`);
upload changes the DSP layout and needs an explicit user action. The file contains the block table, from which the mapping can be
read automatically.

Example from the RPM26z_01 template:

| Block | ID | Type |
|---|---|---|
| Input 1, 2 | 0x01, 0x02 | 0x0105 |
| Input A, B | 0x09, 0x0a | 0x0103 |
| Generator 1 | ? | ? (unclear) |
| Parametric 1–3 | 0x07, 0x15, 0x16 | 0x0608 |
| Compressor 1 | 0x08 | 0x0500 |
| Output 1–6 | 0x0b–0x10 | 0x0106 |
| Delay 1–3 | 0x11, 0x13, 0x14 | 0x0301 |
| Crossover 1 | 0x12 | 0x060f |
| Level 1, 2 | 0x17, 0x18 | 0x0180 |
| Limiter 1, 2 | 0x19, 0x1a | 0x0501 |
| Mixer 1 | 0x1b | 0x0200 |

Parameter record = `00 <block id> <block type> <index>`.

### Configuration file layout (verified on the RPM26z_01 template)

The file `file` (about 19 kB) has three parts:

1. **Header**, 10 bytes, e.g. `01 00 1a 00 00 00 4c 80 00 1d` (verified on
   both fixtures against the `.r26` `<Header>` attributes and the file size):

   | Byte | Meaning |
   |---|---|
   | 0 | script revision (1) |
   | 1 | unknown, 0 in all samples |
   | 2 | platform ID (26 = RPM 26z) |
   | 3 | hardware revision (0) |
   | 4..7 | remaining size = file size − 8 (u32) |
   | 8..9 | block count + 5 |

2. **Block table with wiring.** Each record (u16 big-endian):

   | Bytes | Meaning |
   |---|---|
   | 0 | 0x00 |
   | 1 | block ID |
   | 2..3 | block type |
   | 4..5 | always `00 01` |
   | 6..7 | extra size = 11 + name length |
   | 8..17 | x, y, reserved (0), kind, channel |
   | 18 | name length, then the name (Latin-1) |
   | then | input count, output count, one wire number per input and output |

   Kind: 0x4c analog input, 0x2c digital input, 0x54 output, 0x04 processing
   (inferred from samples). Channel is the physical channel of I/O blocks,
   0 otherwise. Wires 0x00xx are physical connectors (0x01–0x02 analog in,
   0x21–0x22 AES in, 0x11–0x16 outputs), 0x01xx internal links, 0 =
   unconnected. The same wire number on one block's output and another
   block's input = a connection.

   The table ends with a record of type 0xfd01 and ID 0: `00 00 fd 01 00 01`,
   extra size, then 5 bytes of unknown meaning (`a5 00 12 00 01`) and the
   configuration name without a length byte (`RPM 26z Configuration`).
   Parsing and serializing round-trip byte-exact on both fixtures.
3. **Compiled DSP program** (Motorola 56k) and coefficients, generated by the
   Drag Net compiler (see [compiler.md](compiler.md)). Not decoded.

So the app can read the full schematic (blocks, names, positions, wiring) from
the file and upload a file to the device. A new topology needs the compiler.

Code: `parseBlockTable` / `serializeBlockTable` in `@rackline/protocol`
(reference: `tools/sim/parse_cfg.py`).

### `.r26` project files

`.r26` is flat XML (`<RPM SOFTWAREVERSION="4.200000">`, CRLF line endings).

- `<Script><Header …/>` repeats the config header fields.
- Each block is a `<Block>` element plus the same record in
  `<RawScript Data="1,0,26,…,">`: the config file's header, block table and
  end-of-table record as comma-separated decimal bytes (trailing comma),
  followed by 20 more bytes that also start the program part of a downloaded
  config. No compiled DSP code. Header bytes 8–9 = block count + 5 (otherwise
  Drag Net reports INTERNAL_ERR).
- `<Presets><Preset Number="n">` (0 and 1–24; empty ones self-closing) hold
  `<Param d="objectType,address,index,size,value"/>`, where `address` is
  record bytes 0..1 (`target << 8 | instance`). So
  `d="1552,8,4,2,500"` = record `00 08 0610` idx 4, 2 bytes, 500 and
  `d="57345,1152,2,1,0"` = `04 80 e001` idx 2. Meaning of preset 0 vs. the
  device's working state: unverified.
- `<Remotes>` (group masters, software/hardware links, remote presets) is not
  decoded yet.

Code: `parseR26` in `@rackline/protocol`.

### Configuration upload sequence (as Drag Net does it)

1. write `04 05 fe00` idx 0 = 0x2a56 (start of transfer)
2. TFTP WRQ `file`
3. write idx 0 = 0 to all blocks, then write all non-default parameter values
4. write remote-control tables (`fc07`, `fc05`, `fc06`)
5. write `04 05 fe00` idx 0 = 0x2100 (end of transfer)

Download: TFTP RRQ `file`, then read all parameters of all blocks (from the
block table).

## 4. Parameters by block type (verified with the simulator)

"raw" is the value in the record.

### Conversions

| Quantity | Conversion |
|---|---|
| Levels (Mixer, Level, Output Trim, Input User Trim, Generator Level, Limiter Threshold) | dB = (raw − 192) / 2, raw 0 = −96 dB (Level: Off) |
| Digital/analog input trim | dB = raw − 96 (0 = −100 dB) |
| Compressor threshold | dBFS = raw − 96, max 32 |
| PEQ gain | dB = (raw − 120) / 4 |
| PEQ bandwidth | octaves = 0.025 · (raw + 1) |
| Frequency (PEQ, crossover, generator) | raw = Hz (2 bytes) |
| Delay | ms = raw / 48 (samples at 48 kHz, 2 bytes) |
| Attack (0–15) | 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 25, 50, 75, 100 ms |
| Release (0–14) | 1, 5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2000, 3000, 4000, 5000 ms |
| Ratio (0–28) | 1.0, 1.1 … 1.9, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.25, 3.5, 3.75, 4, 4.5, 5, 6, 8, 10, 12, 15, 20, ∞ : 1 |

**Enums:** PEQ type 0 Band, 1 Low Shelf, 2 Hi Shelf, 3 (used in Lukas's
presets, name unverified; probably Low Cut), 4 Hi Cut, 5 Horn EQ,
6 All-Pass. Crossover type 0 Off, 1 LR12, 2 LR24, 4 BW18, 5 BW24, 6 Bessel12,
8 Bessel24. Input gain select 0 Pro, 1 +12 dB Consumer, 2 User. Generator
0 Pink, 1 Sine. Level Mute/Opt bit0 mute, bit1 off at minimum.

### Indexes

| Type | Indexes |
|---|---|
| Digital Input 0x0103 | 2 Trim, 3 Mute |
| Analog Input 0x0105 | 2 Gain Sel, 3 User Trim, 4 Trim, 5 Mute |
| Analog Output 0x0106 | 2 Trim, 3 Mute, 4 Invert |
| Level 0x0180 | 2 Level, 3 Mute/Opt, 5 Min, 6 Max |
| Mixer 2×1 0x0200 | 2/4 input level, 3/5 mute, 6 output, 7 output mute |
| Delay 0x0301 | 2 Delay |
| Compressor 0x0500 | 2 Threshold, 3 Attack, 4 Release, 5 Ratio |
| Limiter 0x0501 | 2 Threshold, 3 Attack, 4 Release |
| 9-band PEQ 0x0608 | band n (1–9): Enable 5n−3, Type 5n−2, Freq 5n−1, BW 5n, Gain 5n+1 |
| 2-way Crossover 0x060f | LP: 3 Type, 4 Freq, 5 Invert; HP: 7 Type, 8 Freq, 9 Invert |
| Generator 0x0700 | 2 Sine, 3 Level, 4 Freq, 5 Mute |

From Lukas's config: 0x0610 = 3-way crossover, parameter groups of 4 from
idx 2 (LowUpper: type 3, freq 4, invert 5?; MidLower 8; MidUpper 12;
HighLower 16), outputs in order High, Mid, Low. 0x0601 = 2-band PEQ,
0x0603 = 4-band PEQ (same 5-per-band layout).

- **PEQ block types:** 0x0600 + filters − 1 (seen: 2, 4 and 9 filters). The
  other sizes (1–15) are assumed to follow the pattern (unverified).
- **2-way output order:** High, Low, inferred from Lukas's config (the
  second output, low-pass 120 Hz, feeds SUB FLEX; the first is unconnected).
- **Unknown indexes:** the index before each crossover filter group (2-way:
  2, 6; 3-way: 2, 6, 10, 14) is 1 in all samples; Level idx 4 is 255. Not
  exposed.

Code: the module registry in `@rackline/model` (`findModule`,
`decodeParam` / `encodeParam`, `decodeBlockValues`) holds these indexes and
conversions; the tests decode Lukas's preset 0.

Other variants (3/4-way crossovers, PEQs with other band counts, other mixers)
use the same type families and are mapped the same way.
