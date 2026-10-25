import type { UdpPacket, UdpSocket } from '../src/index.js';

export interface Sent {
  data: Uint8Array;
  port: number;
  address: string;
}

/**
 * In-memory UDP socket. `respond` plays the device: it sees every sent
 * packet and returns the packets the device sends back (delivered on the
 * next microtask, like a network would, never synchronously).
 */
export class FakeSocket implements UdpSocket {
  readonly sent: Sent[] = [];
  closed = false;
  private readonly listeners = new Set<(packet: UdpPacket) => void>();

  constructor(public respond: (sent: Sent) => UdpPacket[] = () => []) {}

  send(data: Uint8Array, port: number, address: string): Promise<void> {
    const sent = { data: data.slice(), port, address };
    this.sent.push(sent);
    const replies = this.respond(sent);
    queueMicrotask(() => replies.forEach((p) => this.deliver(p)));
    return Promise.resolve();
  }

  deliver(packet: UdpPacket): void {
    for (const listener of [...this.listeners]) listener(packet);
  }

  onPacket(listener: (packet: UdpPacket) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}
