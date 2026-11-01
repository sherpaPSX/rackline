import type { FoundDevice } from '@rackline/api';
import { decodeDiscoveryReply, encodeFindAll, PORTS } from '@rackline/protocol';
import type { UdpSocket } from './udp.js';

export interface DiscoveryOptions {
  /** How long to collect replies. */
  listenMs?: number;
  broadcastAddress?: string;
}

/**
 * Broadcast `RA` and collect the replies (docs/protocol.md §1). `socket` must
 * be bound to UDP 5132 with broadcast enabled. Only finds devices; giving one
 * a new IP (`WI`) is never done here.
 */
export function discoverDevices(socket: UdpSocket, options: DiscoveryOptions = {}): Promise<FoundDevice[]> {
  const found = new Map<string, FoundDevice>();
  const unsubscribe = socket.onPacket((packet) => {
    const reply = decodeDiscoveryReply(packet.data);
    if (reply.ok && reply.value.command === 'RA') found.set(reply.value.mac, { ip: reply.value.ip, mac: reply.value.mac });
  });
  return new Promise((resolve) => {
    const done = (): void => {
      unsubscribe();
      resolve([...found.values()]);
    };
    setTimeout(done, options.listenMs ?? 1000);
    socket.send(encodeFindAll(), PORTS.discoveryDevice, options.broadcastAddress ?? '255.255.255.255').catch(done);
  });
}
