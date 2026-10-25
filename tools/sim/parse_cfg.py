"""Parse the block table of an RPM config file (the TFTP `file`).

Reference implementation for @rackline/protocol. Usage: parse_cfg.py FILE
"""
import json
import sys


def u16(d, o):
    return int.from_bytes(d[o:o + 2], 'big')


def parse(d):
    o = 10
    blocks = []
    while o < len(d) and len(blocks) < 200:
        if d[o] != 0 or d[o + 4:o + 6] != b'\0\1':
            break
        bid = d[o + 1]
        bt = u16(d, o + 2)
        if bt == 0xfd01:
            break
        fields = [u16(d, o + 6 + 2 * i) for i in range(5)]
        channel = u16(d, o + 16)
        n = d[o + 18]
        name = d[o + 19:o + 19 + n].decode('latin1')
        o += 19 + n
        nin = u16(d, o)
        nout = u16(d, o + 2)
        o += 4
        wires = [u16(d, o + 2 * i) for i in range(nin + nout)]
        o += 2 * (nin + nout)
        blocks.append(dict(id=bid, btype=bt, btypeHex='0x%04x' % bt, name=name, fields=fields,
                           channel=channel, inputs=wires[:nin], outputs=wires[nin:]))
    return dict(header=d[:10].hex(), declaredCount=u16(d, 2), blocks=blocks, tableEnd=o)


if __name__ == '__main__':
    json.dump(parse(open(sys.argv[1], 'rb').read()), sys.stdout, indent=1)
