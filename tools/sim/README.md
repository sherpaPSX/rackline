# Simulator

`fake_rpm.py` pretends to be a Rane RPM 26z on the network: it answers
discovery (UDP 5131 → 5132), parameter frames (UDP 5000) and TFTP (UDP 69).
The original Drag Net 4.2 accepts it as a real device, which is how the
protocol in `docs/protocol.md` was verified.

```sh
python3 -I tools/sim/fake_rpm.py      # data and log in tools/sim/.data/
```

- The device answers as `192.168.69.22` (factory default). For Drag Net to
  find it on one machine, add that address to the loopback interface
  (Linux: `ip addr add 192.168.69.22/24 dev lo`, macOS:
  `sudo ifconfig lo0 alias 192.168.69.22`).
- `.data/values.json` sets initial parameter values
  (`"<record hex>:<index>": raw`, e.g. `"04110fb05:0"`), `.data/store.json`
  keeps values written by clients, `.data/tftp/` holds uploaded configs.
- Meter reads (index 0x8000 and up) without a stored value get a moving
  level (gain reduction for 0x05xx blocks), so the UI meters move.
- `parse_cfg.py FILE` prints the block table of a config file; it is the
  reference for the TypeScript parser in `@rackline/protocol`.

## Rackline core against the simulator

```sh
python3 -I tools/sim/fake_rpm.py
pnpm --filter @rackline/server start --connect 127.0.0.1
```

The core connects over loopback (no alias needed), downloads `.data/tftp/file`
(put a configuration there first, e.g. one uploaded by Drag Net), reads all
values and serves the WebSocket API on `ws://127.0.0.1:5180`.

Running Drag Net itself under Wine is described in the `rpm-simulator` skill.
Never commit Drag Net or any Rane files.
