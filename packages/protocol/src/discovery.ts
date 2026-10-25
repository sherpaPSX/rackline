import { DISCOVERY_PACKET_SIZE } from './constants.js';
import { fail, ok, type Result } from './result.js';

/**
 * Discovery packets on UDP 5131 (device) / 5132 (PC). Every packet is
 * 82 bytes; the first two are an ASCII command. See docs/protocol.md §1.
 */
export type DiscoveryCommand = 'RA' | 'RM' | 'WI';

/** Dotted IPv4 address, e.g. `192.168.69.22`. */
export type Ipv4 = string;
/** MAC address as lower-case hex pairs separated by colons. */
export type Mac = string;

export interface DiscoveryReply {
  command: DiscoveryCommand;
  ip: Ipv4;
  mac: Mac;
}

const COMMANDS: readonly DiscoveryCommand[] = ['RA', 'RM', 'WI'];

function packet(command: DiscoveryCommand): Uint8Array {
  const bytes = new Uint8Array(DISCOVERY_PACKET_SIZE);
  bytes[0] = command.charCodeAt(0);
  bytes[1] = command.charCodeAt(1);
  return bytes;
}

/** `RA`: broadcast to 255.255.255.255:5131 to find all devices. */
export function encodeFindAll(): Uint8Array {
  return packet('RA');
}

/** `RM`: sent to one device's IP to ask for its MAC. */
export function encodeGetMac(): Uint8Array {
  return packet('RM');
}

/**
 * `WI`: broadcast that gives the device with `mac` a new static IP.
 *
 * DANGEROUS: a wrong address makes the device unreachable. Only send it after
 * an explicit user action (see CLAUDE.md).
 */
export function encodeSetIp(target: { mac: Mac; ip: Ipv4; netmask: Ipv4 }): Uint8Array {
  const bytes = packet('WI');
  bytes.set(parseIpv4(target.ip), 2);
  bytes.set(parseMac(target.mac), 6);
  bytes.set(parseIpv4(target.netmask), 12);
  return bytes;
}

/** Decode a device's reply (received on UDP 5132). */
export function decodeDiscoveryReply(bytes: Uint8Array): Result<DiscoveryReply> {
  if (bytes.length !== DISCOVERY_PACKET_SIZE) {
    return fail(`discovery packet must be ${DISCOVERY_PACKET_SIZE} bytes, got ${bytes.length}`);
  }
  const command = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0);
  if (!isCommand(command)) return fail(`unknown discovery command ${JSON.stringify(command)}`);
  return ok({
    command,
    ip: formatIpv4(bytes.subarray(2, 6)),
    mac: formatMac(bytes.subarray(6, 12)),
  });
}

function isCommand(value: string): value is DiscoveryCommand {
  return (COMMANDS as readonly string[]).includes(value);
}

/** Parse a dotted IPv4 address. Throws on malformed input (programmer error). */
export function parseIpv4(ip: Ipv4): Uint8Array {
  const parts = ip.split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)) {
    throw new RangeError(`invalid IPv4 address: ${ip}`);
  }
  return Uint8Array.from(parts, Number);
}

export function formatIpv4(bytes: Uint8Array): Ipv4 {
  return Array.from(bytes.subarray(0, 4)).join('.');
}

/** Parse a MAC written as six hex pairs separated by `:` or `-`. Throws on malformed input. */
export function parseMac(mac: Mac): Uint8Array {
  const parts = mac.split(/[:-]/);
  if (parts.length !== 6 || parts.some((p) => !/^[0-9a-fA-F]{2}$/.test(p))) {
    throw new RangeError(`invalid MAC address: ${mac}`);
  }
  return Uint8Array.from(parts.map((p) => parseInt(p, 16)));
}

export function formatMac(bytes: Uint8Array): Mac {
  return Array.from(bytes.subarray(0, 6), (b) => b.toString(16).padStart(2, '0')).join(':');
}
