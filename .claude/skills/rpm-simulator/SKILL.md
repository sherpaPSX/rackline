---
name: rpm-simulator
description: Run the fake Rane RPM 26z and the original Drag Net under Wine to check protocol behaviour or capture samples without hardware. Use when verifying a protocol change, decoding an unknown parameter or making a new fixture.
---

# Simulator and Drag Net under Wine

There is no RPM on hand. Two tools replace it:

- `tools/sim/fake_rpm.py`: answers discovery, parameter frames and TFTP,
  logs every packet to `tools/sim/.data/log.txt`.
- The original **Drag Net 4.2 under Wine** talking to the fake RPM: the
  ground truth for what Drag Net sends and how it reads our files.

## Fake RPM

```sh
python3 -I tools/sim/fake_rpm.py
```

- Answers as 192.168.69.22; put that address on loopback (see
  `tools/sim/README.md`). Ports 69 and 5000 must be free.
- Preload values with `.data/values.json`
  (`"<record hex>:<index>": raw`). Values written by clients persist in
  `.data/store.json`; delete it to reset.
- Uploaded configs land in `.data/tftp/file` (and numbered copies). To let a
  client download a config, put it at `.data/tftp/file`.
- Device type: `"0411fb05:2": 96` (0x60 = RPM 26z). Firmware 2.5.3:
  `"0411fb05:0": 25`, `"0411fb05:3": 3`. Without the firmware values Drag Net
  shows `<Code Load>`.

## Drag Net under Wine (Linux, headless)

Drag Net is **not** in this repo and must never be committed. Lukas provides
the installer; the user's own copy is the only source.

1. Install Wine 9 + Xvfb (`Xvfb :99 &`, `DISPLAY=:99`), create a prefix,
   install Drag Net from the user's copy. The installer is InstallShield with
   an encoded overlay; extracting the MSI with `msiextract` also works.
2. Start the fake RPM, then `wine DragNet.exe`. It discovers the device;
   connect to it.
3. Drive the UI with `xdotool` (click, type values, Tab to commit) and take
   screenshots with `import -window root shot.png` to see the result.
4. To decode a parameter: change one field in Drag Net, then read the write
   record (`< 01 …`) in the simulator log right after it.
5. To make a fixture: build a minimal config with one module, send it to the
   device, copy `.data/tftp/file`, and save the `.r26` from Drag Net.

## Checks to run after a protocol change

- Our encoder's bytes equal what Drag Net sent in the log for the same action.
- A config uploaded by our code loads in Drag Net and shows the same values.
- Write down anything that only the simulator confirms: it still needs a
  hardware check later.
