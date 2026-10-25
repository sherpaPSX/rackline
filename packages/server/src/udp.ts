import { createSocket } from 'node:dgram';

export interface UdpPacket {
  data: Uint8Array;
  address: string;
  port: number;
}

/**
 * The little of a UDP socket the core needs. The device clients take this
 * interface, so tests drive them with a fake device instead of the network.
 */
export interface UdpSocket {
  send(data: Uint8Array, port: number, address: string): Promise<void>;
  /** Calls `listener` for every received packet until the returned function is called. */
  onPacket(listener: (packet: UdpPacket) => void): () => void;
  close(): Promise<void>;
}

export interface UdpSocketOptions {
  /** Local port; 0 (default) picks a free one. */
  port?: number;
  /** Allow sending to broadcast addresses (discovery). */
  broadcast?: boolean;
}

export function openUdpSocket(options: UdpSocketOptions = {}): Promise<UdpSocket> {
  const socket = createSocket({ type: 'udp4', reuseAddr: true });
  const listeners = new Set<(packet: UdpPacket) => void>();
  socket.on('message', (data, remote) => {
    const packet = { data: new Uint8Array(data), address: remote.address, port: remote.port };
    for (const listener of listeners) listener(packet);
  });

  return new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(options.port ?? 0, () => {
      socket.off('error', reject);
      // Errors after binding (e.g. ICMP unreachable) surface as request timeouts.
      socket.on('error', () => undefined);
      if (options.broadcast === true) socket.setBroadcast(true);
      resolve({
        send: (data, port, address) =>
          new Promise((done, fail) => socket.send(data, port, address, (error) => (error ? fail(error) : done()))),
        onPacket: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        close: () => new Promise((done) => socket.close(() => done())),
      });
    });
  });
}
