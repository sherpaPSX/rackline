# Drag Net DSP compiler (compilerdll.dll)

Verified 2026-10-24 under Wine. Needed only for phase 2 (editing the setup).

- Export #4 `compile_script(u8* script, u32 len, status*, dsp_code*, u32 = 1, block_lowinfo*)`,
  cdecl. Buffer sizes: status 0x98c×4 B, dsp_code 0x13c1b×4 B,
  block_lowinfo 0x1c5c0a×4 B (zeroed).
- `script` = the start of the configuration file: 10-byte header, block table
  and the 0xfd01 record with the configuration name (same as `RawScript` in a
  `.r26`). **Header bytes 6..7 = script length + 32**, otherwise it returns
  SCRIPT_ERR.
- `status[0]` = error count, error text from offset 8.
- Output `dsp_code`: 24-bit words stored as little-endian uint32. DSP0 program
  starts at offset 0xb000, DSP1 at 0x1ec00.
- Check: for the RPM26z_01 template, 18,446 of the 18,672 bytes of the
  compiled part of the file that Drag Net sends over TFTP match the compiler
  output directly (words repacked as 3-byte big-endian). The rest are small
  section headers (`fa 00` / `fa 01` = DSP0/DSP1 code, `f9 00` = block table →
  DSP and parameter address), which can be built from `block_lowinfo`.
