# Rackline

A modern controller for **Rane RPM** DSP processors (RPM 26z first), the
discontinued installed-sound processors originally configured with Rane Drag Net.

Rackline finds the device on the network by itself (no IP setup), shows the
signal chain as racks of modules, and lets you tune it from a laptop or, later,
from your phone's browser.

> **Status:** planning and project skeleton. Nothing usable yet. The protocol
> has been verified against a simulator only, not on real hardware.

## Disclaimer

**Unofficial fan-made software.** This project is not developed, endorsed or
supported by Rane Corporation or its owner, inMusic Brands. "Rane", "RPM" and
"Drag Net" are trademarks of their respective owners and are used here only to
describe compatibility.

The software is provided "as is", without warranty of any kind (see
[LICENSE](LICENSE)). The author is not liable for its correct operation or for
any damage resulting from its use, including damage to loudspeakers,
amplifiers or hearing, or disruption of an event. **Use at your own risk.**
Always verify settings and back up the device configuration before using it at
an event.

Rackline's source code contains no code from Rane. The network protocol was
determined by reverse engineering solely for interoperability. Editing the DSP
layout (a later phase) uses the DSP compiler from Drag Net
(`compilerdll.dll`), which remains the property of its copyright owner and is
not covered by the MIT license. If you are the rights holder and object,
please open an issue and it will be removed.

## Roadmap

1. **Tune an existing setup**: levels, mute, EQ, delay, limiters, presets,
   meters. The setup is read from the device or a Drag Net `.r26` file.
2. **Edit the setup**: add, remove and reorder modules and racks.
3. **Phone remote**: the same UI served to your phone's browser over Wi-Fi.

Platforms: macOS and Windows.

## Development

Requires Node 24 and pnpm (`corepack enable`).

```sh
pnpm install
pnpm check      # typecheck + lint + unit tests
```

- Architecture and package map: [docs/architecture.md](docs/architecture.md)
- Protocol notes: [docs/protocol.md](docs/protocol.md)
- Simulator (fake RPM for development without hardware): [tools/sim](tools/sim)

## License

[MIT](LICENSE) © Lukas Werner and contributors.
