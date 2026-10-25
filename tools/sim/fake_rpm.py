"""Fake Rane RPM 26z for development without hardware.

Answers discovery (UDP 5131), parameter frames (UDP 5000/5001) and TFTP
(UDP 69) well enough for the original Drag Net and for Rackline.
See docs/protocol.md. Data lives in $SIM_DIR (default: tools/sim/.data).
"""
import json
import os
import socket
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SIM_DIR = os.environ.get('SIM_DIR', os.path.join(HERE, '.data'))
os.makedirs(os.path.join(SIM_DIR, 'tftp'), exist_ok=True)

IP = [192, 168, 69, 22]
MAC = bytes([0x00, 0x50, 0xc2, 0x12, 0x34, 0x56])
VALUES = os.path.join(SIM_DIR, 'values.json')  # initial values, "<rec hex>:<index>" -> int
STORE = os.path.join(SIM_DIR, 'store.json')    # values written by clients

try:
    store = json.load(open(STORE))
except Exception:
    store = {}
log = open(os.path.join(SIM_DIR, 'log.txt'), 'a', buffering=1)


def L(*a):
    log.write(time.strftime('%H:%M:%S ') + ' '.join(map(str, a)) + '\n')


def initial_values():
    try:
        return json.load(open(VALUES))
    except Exception:
        return {}


def udp(port, broadcast=False):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    if broadcast:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    s.bind(('0.0.0.0', port))
    return s


def discovery():
    s = udp(5131, broadcast=True)
    while True:
        d, a = s.recvfrom(2048)
        L('5131 <', a, d[:24].hex())
        r = bytearray(82)
        r[0:2] = d[0:2]
        r[2:6] = bytes(IP)
        r[6:12] = MAC
        if d[:2] == b'WI':
            IP[:] = list(d[2:6])
            r[2:6] = d[2:6]
        s.sendto(bytes(r), (a[0], 5132))


def control(port):
    s = udp(port)
    while True:
        d, a = s.recvfrom(4096)
        if len(d) != 905:
            L(port, '<', a, len(d), d[:64].hex())
            continue
        n = d[8]
        recs = [d[9 + 14 * i:23 + 14 * i] for i in range(n)]
        L(port, '<', d[:9].hex(), ' | '.join(r.hex() for r in recs))
        init = initial_values()
        r = bytearray(d)
        r[0] = 2
        r[1:3] = b'\0\0'
        for i, rec in enumerate(recs):
            key = '%s:%d' % (rec[0:4].hex(), int.from_bytes(rec[4:6], 'big'))
            at = 9 + 14 * i + 10
            if d[0] == 1:
                store[key] = int.from_bytes(rec[10:14], 'big')
            elif key in store:
                r[at:at + 4] = store[key].to_bytes(4, 'big')
            elif key in init:
                r[at:at + 4] = int(init[key]).to_bytes(4, 'big')
        if d[0] == 1:
            json.dump(store, open(STORE, 'w'))
        s.sendto(bytes(r), a)


def tftp():
    s = udp(69)
    sessions = {}
    count = 0
    while True:
        d, a = s.recvfrom(4096)
        op = int.from_bytes(d[:2], 'big')
        if op in (1, 2):  # RRQ, WRQ
            fn = d[2:].split(b'\0')[0].decode(errors='replace')
            count += 1
            path = os.path.join(SIM_DIR, 'tftp', fn)
            L('TFTP', ('RRQ', 'WRQ')[op - 1], fn, a)
            if op == 2:
                sessions[a] = dict(fn=fn, buf=bytearray(), blk=0)
                s.sendto(b'\0\4\0\0', a)
            else:
                try:
                    data = open(path, 'rb').read()
                except OSError:
                    data = b''
                sessions[a] = dict(fn=fn, data=data, blk=1)
                s.sendto(b'\0\3\0\1' + data[:512], a)
        elif op == 3 and a in sessions:  # DATA
            c = sessions[a]
            b = int.from_bytes(d[2:4], 'big')
            if b == c['blk'] + 1:
                c['buf'] += d[4:]
                c['blk'] = b
            s.sendto(b'\0\4' + d[2:4], a)
            if len(d) - 4 < 512:
                base = os.path.join(SIM_DIR, 'tftp', c['fn'])
                open('%s_%03d' % (base, count), 'wb').write(c['buf'])
                open(base, 'wb').write(c['buf'])
                L('TFTP stored', base, len(c['buf']))
                del sessions[a]
        elif op == 4 and a in sessions:  # ACK
            c = sessions[a]
            b = int.from_bytes(d[2:4], 'big')
            if b == c['blk']:
                if len(c['data'][(b - 1) * 512:b * 512]) < 512:
                    L('TFTP served', c['fn'], len(c['data']))
                    del sessions[a]
                    continue
                c['blk'] += 1
                b = c['blk']
            s.sendto(b'\0\3' + b.to_bytes(2, 'big') + c['data'][(b - 1) * 512:b * 512], a)
        else:
            L('TFTP other', op, d[:20].hex(), a)


if __name__ == '__main__':
    threading.Thread(target=tftp, daemon=True).start()
    threading.Thread(target=discovery, daemon=True).start()
    for p in (5000, 5001):
        threading.Thread(target=control, args=(p,), daemon=True).start()
    print('fake RPM 26z running, data in', SIM_DIR)
    while True:
        time.sleep(1)
