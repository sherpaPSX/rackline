import { execFile } from "node:child_process";
import { networkInterfaces } from "node:os";
import type { FoundDevice } from "@rackline/api";
import {
  encodeSetIp,
  fail,
  hostAddresses,
  inNetwork,
  ok,
  PORTS,
  type Ipv4Network,
  type Result,
} from "@rackline/protocol";
import { discoverDevices } from "./discovery.js";
import type { UdpSocket } from "./udp.js";

export interface PlugAndPlayOptions {
  /** The PC's IPv4 networks; the first one is where devices are moved to. */
  networks: readonly Ipv4Network[];
  /** Whether nobody on the network uses `ip`. */
  isFree(ip: string): Promise<boolean>;
  /** How long each discovery round after `WI` listens (default 1 s). */
  listenMs?: number;
  /** Discovery rounds before giving up on the device taking the address (default 5). */
  rounds?: number;
  /** Free-address candidates to probe before giving up (default 20). */
  maxProbes?: number;
}

/** Whether the PC reaches `ip` without a router. */
export const reachable = (
  ip: string,
  networks: readonly Ipv4Network[],
): boolean => networks.some((n) => inNetwork(ip, n));

/**
 * Plug-and-play (docs/protocol.md §1): a device outside every PC network gets
 * a free address in the first one by a `WI` broadcast, so an RPM still on its
 * factory address works without touching the network settings. Returns the
 * device with the address to use. `socket` must be bound to UDP 5132 with
 * broadcast enabled. Only call it on an explicit user action (connecting to
 * that device): `WI` rewrites the device's network settings.
 */
export async function moveIntoNetwork(
  socket: UdpSocket,
  device: FoundDevice,
  options: PlugAndPlayOptions,
): Promise<Result<FoundDevice>> {
  if (reachable(device.ip, options.networks)) return ok(device);
  const network = options.networks[0];
  if (network === undefined) return fail("this computer is not on any network");

  let ip: string | undefined;
  for (const candidate of hostAddresses(network).slice(
    0,
    options.maxProbes ?? 20,
  )) {
    if (await options.isFree(candidate)) {
      ip = candidate;
      break;
    }
  }
  if (ip === undefined)
    return fail(
      `no free address for the device in ${network.address}/${network.netmask}`,
    );

  await socket.send(
    encodeSetIp({ mac: device.mac, ip, netmask: network.netmask }),
    PORTS.discoveryDevice,
    "255.255.255.255",
  );
  for (let round = 0; round < (options.rounds ?? 5); round++) {
    const found = await discoverDevices(socket, {
      listenMs: options.listenMs ?? 1000,
    });
    const moved = found.find((d) => d.mac === device.mac);
    if (moved?.ip === ip) return ok(moved);
  }
  return fail(`the device at ${device.ip} did not take the address ${ip}`);
}

/** The PC's IPv4 networks that can hold a device: no loopback, link-local or point-to-point (VPN) ones. */
export function localNetworks(): Ipv4Network[] {
  return Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter(
      (i) =>
        i.family === "IPv4" && !i.internal && !i.address.startsWith("169.254."),
    )
    .filter(
      (i) => i.netmask !== "255.255.255.255" && i.netmask !== "255.255.255.254",
    )
    .map((i) => ({ address: i.address, netmask: i.netmask }));
}

/**
 * An address is free when it answers no ping and the system has no MAC for
 * it afterwards (a PC with a firewall drops the ping but still answers ARP).
 */
export async function isAddressFree(ip: string): Promise<boolean> {
  const windows = process.platform === "win32";
  const pinged = await run(
    "ping",
    windows ? ["-n", "1", "-w", "700", ip] : ["-c", "1", "-t", "1", ip],
  );
  if (pinged.ok) return false;
  const arp = await run("arp", windows ? ["-a", ip] : ["-n", ip]);
  return !/([0-9a-f]{1,2}[:-]){5}[0-9a-f]{1,2}/i.test(arp.output);
}

function run(
  command: string,
  args: string[],
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: 3000 }, (error, stdout) =>
      resolve({ ok: error === null, output: stdout }),
    );
  });
}
