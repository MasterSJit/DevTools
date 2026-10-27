// DevForge proxy — a Cloudflare Worker that does only what browsers can't:
//   GET /api/inspect?url=…[&body=1]  → status, redirect chain, response headers (+ text body for SEO checks)
//   GET /api/whois?q=domain          → legacy port-43 WHOIS for TLDs without RDAP
//   GET /api/health                  → { ok: true }
// It never forwards cookies or credentials and only reads public http(s) URLs.
import { connect } from 'cloudflare:sockets';

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 10000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const BODY_TYPES = /^(text\/(html|plain|xml)|application\/(xhtml\+xml|xml|rss\+xml|atom\+xml))/i;
const USER_AGENT = 'Mozilla/5.0 (compatible; DevForgeInspector/1.0; +https://dev-tools.serversbay.com)';

class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = origin && allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', Vary: 'Origin' }
      : {};

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    // Browsers on other websites must not be able to use this proxy.
    if (origin && !allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403, cors);
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, cors);

    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'anonymous' });
      if (!success) return json({ error: 'Too many requests — please wait a minute.' }, 429, cors);
    }

    try {
      const path = url.pathname.replace(/^\/api/, '') || '/';
      if (path === '/inspect') return json(await inspect(url.searchParams), 200, cors);
      if (path === '/whois') return json(await cached(request, ctx, () => whois(url.searchParams.get('q'))), 200, cors);
      if (path === '/health') return json({ ok: true }, 200, cors);
      return json({ error: 'Not found' }, 404, cors);
    } catch (e) {
      const message = e.name === 'TimeoutError' ? 'The target did not respond within 10 seconds.' : e.message;
      return json({ error: message }, e.status || 502, cors);
    }
  },
};

function json(data, status, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-site',
      ...extra,
    },
  });
}

async function cached(request, ctx, produce) {
  const cache = caches.default;
  const key = new Request(request.url, { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit.json();
  const data = await produce();
  ctx.waitUntil(cache.put(key, new Response(JSON.stringify(data), { headers: { 'Cache-Control': 'public, max-age=3600', 'Content-Type': 'application/json' } })));
  return data;
}

// ── SSRF guards ──────────────────────────────────────────────────────────────

const PRIVATE_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

const v4ToInt = (ip) => ip.split('.').reduce((n, x) => n * 256 + Number(x), 0) >>> 0;
const isPrivateV4 = (ip) => PRIVATE_V4.some(([base, bits]) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((v4ToInt(ip) & mask) >>> 0) === ((v4ToInt(base) & mask) >>> 0);
});
const isPrivateV6 = (ip) => /^(::1?$|fe[89ab]|f[cd]|ff|::ffff:(10|127|192\.168|169\.254)\.)/i.test(ip);

function validateUrl(raw) {
  if (!raw) throw new HttpError('Missing ?url=');
  let u;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { throw new HttpError('Invalid URL'); }
  if (!/^https?:$/.test(u.protocol)) throw new HttpError('Only http and https URLs are allowed');
  if (u.port && !['80', '443'].includes(u.port)) throw new HttpError('Only ports 80 and 443 are allowed');
  if (u.username || u.password) throw new HttpError('URLs with credentials are not allowed');
  return u;
}

async function assertPublicHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':')) throw new HttpError('Enter a hostname, not an IP address');
  if (!host.includes('.') || /(^|\.)(localhost|local|internal|lan|home\.arpa|intranet|corp)$/.test(host)) {
    throw new HttpError('Private / internal hostnames are not allowed');
  }
  // Defense in depth: refuse names that resolve to private or reserved addresses.
  const answers = await Promise.all(['A', 'AAAA'].map((type) =>
    fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, { headers: { accept: 'application/dns-json' } })
      .then((r) => r.json()).then((j) => (j.Answer || []).filter((a) => a.type === 1 || a.type === 28).map((a) => a.data))
      .catch(() => [])));
  const ips = answers.flat();
  if (!ips.length) throw new HttpError(`${host} does not resolve (no A/AAAA record)`, 404);
  if (ips.some((ip) => (ip.includes(':') ? isPrivateV6(ip) : isPrivateV4(ip)))) throw new HttpError('Hostname resolves to a private or reserved address');
}

// ── /inspect ─────────────────────────────────────────────────────────────────

async function readCapped(res, limit) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size >= limit) { truncated = true; await reader.cancel(); break; }
  }
  const all = new Uint8Array(Math.min(size, limit));
  let o = 0;
  for (const c of chunks) { const part = c.subarray(0, all.length - o); all.set(part, o); o += part.length; if (o >= all.length) break; }
  return { text: new TextDecoder('utf-8', { fatal: false }).decode(all), bytes: size, truncated };
}

// Cookie values are masked — only names and attributes matter for a security review.
const maskCookie = (c) => c.replace(/^([^=;]+)=([^;]*)/, (_, name, value) => `${name}=${value ? '…' : ''}`);

function headerList(res) {
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : (res.headers.getAll?.('set-cookie') || []);
  const list = [...res.headers].filter(([k]) => k.toLowerCase() !== 'set-cookie');
  return [...list, ...cookies.map((c) => ['set-cookie', maskCookie(c)])];
}

async function inspect(params) {
  const start = validateUrl(params.get('url'));
  const wantBody = params.get('body') === '1';
  const redirects = [];
  const began = Date.now();
  let current = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(current.hostname);
    const t0 = Date.now();
    const res = await fetch(current.href, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Encoding': 'gzip, br' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const ttfbMs = Date.now() - t0;
    const location = res.headers.get('location');

    if (res.status >= 300 && res.status < 400 && location) {
      const next = new URL(location, current);
      redirects.push({ url: current.href, status: res.status, location: next.href, headers: headerList(res) });
      await res.body?.cancel();
      if (!/^https?:$/.test(next.protocol)) throw new HttpError(`Redirect to unsupported scheme ${next.protocol}`);
      if (next.port && !['80', '443'].includes(next.port)) throw new HttpError('Redirect to a non-standard port was blocked');
      current = next;
      continue;
    }

    const contentType = res.headers.get('content-type') || '';
    let body = null;
    let bodyBytes = Number(res.headers.get('content-length')) || null;
    let truncated = false;
    if (wantBody && res.body && BODY_TYPES.test(contentType)) {
      const r = await readCapped(res, MAX_BODY_BYTES);
      body = r.text; bodyBytes = r.bytes; truncated = r.truncated;
    } else {
      await res.body?.cancel();
    }

    return {
      url: start.href,
      finalUrl: current.href,
      status: res.status,
      statusText: res.statusText,
      redirects,
      headers: headerList(res),
      contentType,
      ttfbMs,
      totalMs: Date.now() - began,
      body,
      bodyBytes,
      truncated,
      fetchedAt: new Date().toISOString(),
    };
  }
  throw new HttpError(`Too many redirects (more than ${MAX_REDIRECTS})`);
}

// ── /whois (port 43) ─────────────────────────────────────────────────────────

async function whoisQuery(host, query) {
  const socket = connect({ hostname: host, port: 43 });
  const writer = socket.writable.getWriter();
  await writer.write(new TextEncoder().encode(`${query}\r\n`));
  writer.releaseLock();
  const reader = socket.readable.getReader();
  const chunks = [];
  let size = 0;
  const deadline = Date.now() + 8000;
  try {
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise((resolve) => setTimeout(() => resolve({ done: true }), remaining)),
      ]);
      if (done) break;
      chunks.push(value);
      size += value.length;
      if (size > 256 * 1024) break;
    }
  } finally {
    socket.close();
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return new TextDecoder().decode(out);
}

async function whois(q) {
  const domain = String(q || '').trim().toLowerCase().replace(/\.$/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) throw new HttpError('Enter a domain like example.io');
  const tld = domain.split('.').pop();
  const iana = await whoisQuery('whois.iana.org', tld);
  const server = (iana.match(/^refer:\s*(\S+)/im) || iana.match(/^whois:\s*(\S+)/im) || [])[1];
  if (!server) throw new HttpError(`No WHOIS server is listed for .${tld}`, 404);
  // DENIC only returns full data with this query format
  const query = server === 'whois.denic.de' ? `-T dn,ace ${domain}` : domain;
  let raw = await whoisQuery(server, query);
  // Thin registries point to the registrar's own WHOIS server
  const registrarServer = (raw.match(/Registrar WHOIS Server:\s*(\S+)/i) || [])[1]?.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (registrarServer && registrarServer.toLowerCase() !== server.toLowerCase()) {
    try { raw += `\n\n# ── ${registrarServer} ──\n${await whoisQuery(registrarServer, domain)}`; } catch { /* registrar server unreachable */ }
  }
  return { domain, server, registrarServer: registrarServer || null, raw };
}
