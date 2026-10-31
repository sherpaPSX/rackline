import { formatIpv4, parseIpv4, type Ipv4 } from './discovery.js';

/** One IPv4 network of the PC: its own address and the netmask. */
export interface Ipv4Network {
  address: Ipv4;
  netmask: Ipv4;
}

const toNumber = (ip: Ipv4): number => parseIpv4(ip).reduce((n, b) => n * 256 + b, 0);

function fromNumber(n: number): Ipv4 {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, n);
  return formatIpv4(bytes);
}

/** Whether `ip` is in `network`, i.e. reachable from the PC without a router. */
export function inNetwork(ip: Ipv4, network: Ipv4Network): boolean {
  const mask = toNumber(network.netmask);
  return (toNumber(ip) & mask) >>> 0 === (toNumber(network.address) & mask) >>> 0;
}

/**
 * Host addresses of `network` from the highest down, without the network and
 * broadcast addresses and the PC's own address. Plug-and-play tries them in
 * this order: routers usually hand out DHCP leases from the bottom of the
 * range, so the top is the least likely to clash.
 */
export function hostAddresses(network: Ipv4Network): Ipv4[] {
  const mask = toNumber(network.netmask);
  const base = (toNumber(network.address) & mask) >>> 0;
  const size = 2 ** 32 - mask;
  const own = toNumber(network.address);
  const hosts: Ipv4[] = [];
  for (let n = base + size - 2; n > base; n--) if (n !== own) hosts.push(fromNumber(n));
  return hosts;
}
