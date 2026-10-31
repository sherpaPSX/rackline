import { PORTS } from '@rackline/protocol';
import { Core } from './core.js';
import { openRpm, type RpmOptions } from './device.js';
import { discoverDevices } from './discovery.js';
import { isAddressFree, localNetworks, moveIntoNetwork, reachable } from './plug-and-play.js';
import { openUdpSocket, type UdpSocket } from './udp.js';
import { startWsServer, type WsServer } from './ws-server.js';

/** Replies always go to UDP 5132, so discovery needs that port for its duration. */
async function withDiscoverySocket<T>(use: (socket: UdpSocket) => Promise<T>): Promise<T> {
  const socket = await openUdpSocket({ port: PORTS.discoveryHost, broadcast: true });
  try {
    return await use(socket);
  } finally {
    await socket.close();
  }
}

/** Default WebSocket port of the core. */
export const DEFAULT_PORT = 5180;

export interface RacklineOptions {
  port?: number;
  host?: string;
  /** Where discovery broadcasts `RA` (default 255.255.255.255). */
  broadcastAddress?: string;
  rpm?: RpmOptions;
}

export interface Rackline {
  core: Core;
  server: WsServer;
  close(): Promise<void>;
}

/** The core on real sockets: what the desktop app (and later the phone page) talks to. */
export async function startRackline(options: RacklineOptions = {}): Promise<Rackline> {
  const core = new Core({
    openDevice: (ip) => openRpm(ip, options.rpm),
    discover: async () => {
      const found = await withDiscoverySocket((socket) =>
        discoverDevices(socket, options.broadcastAddress === undefined ? {} : { broadcastAddress: options.broadcastAddress }),
      );
      const networks = localNetworks();
      return found.map((d) => ({ ...d, reachable: reachable(d.ip, networks) }));
    },
    moveIntoNetwork: (device) =>
      withDiscoverySocket((socket) => moveIntoNetwork(socket, device, { networks: localNetworks(), isFree: isAddressFree })),
  });
  const server = await startWsServer(core, { port: options.port ?? DEFAULT_PORT, ...(options.host === undefined ? {} : { host: options.host }) });
  return {
    core,
    server,
    close: async () => {
      await server.close();
      await core.close();
    },
  };
}
