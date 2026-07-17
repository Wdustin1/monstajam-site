import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { normalizeTrustedCoverSourceUrl } from './media-url';

const blockedIpv4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) blockedIpv4.addSubnet(address, prefix, 'ipv4');

const blockedIpv6 = new BlockList();
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
] as const) blockedIpv6.addSubnet(address, prefix, 'ipv6');

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedIpv4.check(address, 'ipv4');
  if (family === 6) {
    const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
    if (mapped) return isPublicIpAddress(mapped);
    return !blockedIpv6.check(address, 'ipv6');
  }
  return false;
}

export function parseAllowedCoverUrl(value: string): URL {
  const canonicalUrl = normalizeTrustedCoverSourceUrl(value);
  if (!canonicalUrl) throw new Error('Invalid cover URL');
  return new URL(canonicalUrl);
}

export async function validateCoverUrlForFetch(value: string): Promise<URL> {
  const url = parseAllowedCoverUrl(value);
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error('Invalid cover URL destination');
  }
  return url;
}
