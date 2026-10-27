// IPv4 / IPv6 parsing helpers shared by the subnet calculator and RDAP lookups.

export const isIPv4 = (s) => /^(\d{1,3}\.){3}\d{1,3}$/.test(s) && s.split('.').every((x) => Number(x) <= 255);
export const isIPv6 = (s) => s.includes(':') && /^[0-9a-f:.]+$/i.test(s.replace(/^\[|\]$/g, ''));

export function ipToInt(ip) {
  const p = ip.split('.');
  if (p.length !== 4 || p.some((x) => !/^\d{1,3}$/.test(x) || Number(x) > 255)) throw new Error(`Invalid IPv4 address “${ip}”`);
  return p.reduce((n, x) => n * 256 + Number(x), 0) >>> 0;
}

export const intToIp = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');

export const maskFromPrefix = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);

/** Parses an IPv6 address (incl. :: and embedded IPv4) to a 128-bit BigInt. */
export function parseIPv6(addr) {
  let s = addr.trim().toLowerCase().replace(/^\[|\]$/g, '');
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = ipToInt(v4[1]);
    s = s.replace(v4[1], `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`);
  }
  const halves = s.split('::');
  if (halves.length > 2) throw new Error('“::” can appear only once');
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) throw new Error('IPv6 address must have 8 groups');
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) throw new Error('Invalid IPv6 group');
  return groups.reduce((n, g) => (n << 16n) | BigInt(parseInt(g, 16)), 0n);
}

/** True when `ip` (v4 or v6 string) falls inside `cidr`. */
export function cidrContains(cidr, ip) {
  const [base, p] = cidr.split('/');
  const prefix = Number(p);
  if (isIPv4(ip) && isIPv4(base)) {
    const m = maskFromPrefix(prefix);
    return ((ipToInt(ip) & m) >>> 0) === ((ipToInt(base) & m) >>> 0);
  }
  if (isIPv6(ip) && base.includes(':')) {
    const shift = BigInt(128 - prefix);
    return (parseIPv6(ip) >> shift) === (parseIPv6(base) >> shift);
  }
  return false;
}
