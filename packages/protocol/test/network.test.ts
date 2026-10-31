import { describe, expect, it } from 'vitest';
import { hostAddresses, inNetwork } from '../src/network.js';

describe('network', () => {
  const home = { address: '192.168.0.131', netmask: '255.255.255.0' };

  it('tells whether an address is in the PC network', () => {
    expect(inNetwork('192.168.0.7', home)).toBe(true);
    expect(inNetwork('192.168.69.71', home)).toBe(false);
    expect(inNetwork('10.1.2.3', { address: '10.0.0.5', netmask: '255.0.0.0' })).toBe(true);
    expect(inNetwork('192.168.70.1', { address: '192.168.69.5', netmask: '255.255.254.0' })).toBe(false);
  });

  it('lists host addresses from the top, skipping network, broadcast and own address', () => {
    const hosts = hostAddresses(home);
    expect(hosts.slice(0, 2)).toEqual(['192.168.0.254', '192.168.0.253']);
    expect(hosts.at(-1)).toBe('192.168.0.1');
    expect(hosts).toHaveLength(253);
    expect(hosts).not.toContain('192.168.0.131');
    expect(hostAddresses({ address: '10.0.0.1', netmask: '255.255.255.252' })).toEqual(['10.0.0.2']);
  });
});
