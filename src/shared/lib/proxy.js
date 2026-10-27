// Client for the DevForge Cloudflare Worker (see /proxy). Only used for things browsers can't do:
// reading another site's headers/HTML and legacy port-43 WHOIS.
// Production: the Worker is routed at https://dev-tools.serversbay.com/api/* (same origin).
// Local dev: set NEXT_PUBLIC_PROXY_URL=http://localhost:8787/api and run `npx wrangler dev` in /proxy.

export const PROXY_BASE = (process.env.NEXT_PUBLIC_PROXY_URL || '/api').replace(/\/$/, '');

export class ProxyUnavailableError extends Error {
  constructor() {
    super('The DevForge proxy (Cloudflare Worker) is not reachable. Deploy it from the /proxy folder, or paste the data manually.');
    this.name = 'ProxyUnavailableError';
  }
}

export async function callProxy(endpoint, params, { timeout = 25000 } = {}) {
  let res;
  try {
    res = await fetch(`${PROXY_BASE}/${endpoint}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(timeout) });
  } catch (e) {
    if (e.name === 'TimeoutError') throw new Error('The proxy timed out.');
    throw new ProxyUnavailableError();
  }
  const type = res.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new ProxyUnavailableError();
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `Proxy returned HTTP ${res.status}`);
  return data;
}

/** Fetches status, redirect chain, headers (and optionally the text body) of a public URL. */
export const inspectUrl = (url, { body = false } = {}) => callProxy('inspect', { url, ...(body && { body: '1' }) });

/** Legacy port-43 WHOIS for TLDs without RDAP. */
export const legacyWhois = (domain) => callProxy('whois', { q: domain });

/** Normalises user input into an absolute http(s) URL. */
export function normalizeUrl(input) {
  const s = input.trim();
  if (!s) throw new Error('Enter a URL');
  const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http:// and https:// URLs are supported');
  return u.href;
}
