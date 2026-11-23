// Domains the network tools refuse to scan (DNS, subdomains, headers, SEO, WHOIS/RDAP, certificate search).
//
// Nothing is hard-coded. Blocked automatically:
//   • the domain this site is served from (and its parent domain + every subdomain), read at runtime
//     from `location.hostname` — so a deployment never scans itself;
//   • anything listed in NEXT_PUBLIC_BLOCKED_DOMAINS (comma-separated, set at build time).
// The proxy Worker enforces the same rule server-side (proxy/src/index.js), so calling it directly
// does not bypass this.

// Common two-label public suffixes, so "a.example.co.uk" → parent "example.co.uk", not "co.uk".
const TWO_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'co.in', 'net.in', 'org.in', 'firm.in', 'gen.in', 'ind.in', 'com.au', 'net.au', 'org.au',
  'co.nz', 'co.jp', 'co.kr', 'com.br', 'com.cn', 'com.mx', 'com.sg', 'com.tr', 'co.za', 'com.hk', 'com.tw', 'com.ar', 'co.id',
]);

const LOCAL = /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|.*\.local$|.*\.localhost$|.*\.test$)/i;

export function parentDomain(host) {
  const labels = host.split('.');
  if (labels.length <= 2) return host;
  const last2 = labels.slice(-2).join('.');
  return TWO_LABEL_SUFFIXES.has(last2) ? labels.slice(-3).join('.') : last2;
}

/** Extract a lowercase hostname from a URL, bare domain, email address or "host:port". */
export function hostOf(input) {
  let s = String(input || '').trim().toLowerCase();
  if (!s) return '';
  if (s.includes('@') && !s.includes('/')) s = s.split('@').pop();
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(s) ? s : `http://${s}`).hostname.replace(/\.$/, '').replace(/^\[|\]$/g, '');
  } catch {
    return s.replace(/[/:?#].*$/, '').replace(/\.$/, '');
  }
}

let cache = null;
export function blockedDomains() {
  if (cache) return cache;
  const list = new Set(
    (process.env.NEXT_PUBLIC_BLOCKED_DOMAINS || '').split(',').map((d) => hostOf(d)).filter(Boolean),
  );
  if (typeof window !== 'undefined') {
    const own = window.location.hostname.toLowerCase();
    if (own && !LOCAL.test(own)) { list.add(own); list.add(parentDomain(own)); }
  }
  cache = list;
  return list;
}

/** True when `input` is a blocked domain or any subdomain of one. */
export function isBlocked(input) {
  const host = hostOf(input);
  if (!host) return false;
  for (const d of blockedDomains()) if (host === d || host.endsWith(`.${d}`)) return true;
  return false;
}

export class BlockedTargetError extends Error {
  constructor(host) {
    super(`Scanning ${host} is disabled on this site.`);
    this.name = 'BlockedTargetError';
  }
}

/** Throw if the target is blocked. Call this before every network lookup. */
export function assertAllowed(input) {
  if (isBlocked(input)) throw new BlockedTargetError(hostOf(input));
}
