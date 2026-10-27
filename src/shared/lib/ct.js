// Certificate Transparency log search (crt.sh and SSLMate Cert Spotter) — both allow browser CORS requests.

const utc = (s) => new Date(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
const issuerShort = (dn) => (dn.match(/CN=([^,]+)/) || [])[1] || (dn.match(/O=([^,]+)/) || [])[1] || dn;

async function crtsh(domain, { subdomains, includeExpired, timeout = 30000 }) {
  const params = new URLSearchParams({ q: subdomains ? `%.${domain}` : domain, output: 'json' });
  if (!includeExpired) params.set('exclude', 'expired');
  // `%.domain` is crt.sh's wildcard syntax; URLSearchParams encodes it as %25 as required
  const res = await fetch(`https://crt.sh/?${params}`, { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`crt.sh returned HTTP ${res.status}`);
  const rows = await res.json();
  return rows.map((r) => ({
    id: r.id,
    source: 'crt.sh',
    link: `https://crt.sh/?id=${r.id}`,
    issuer: issuerShort(r.issuer_name),
    issuerFull: r.issuer_name,
    notBefore: utc(r.not_before),
    notAfter: utc(r.not_after),
    serial: r.serial_number,
    names: [...new Set([r.common_name, ...String(r.name_value).split('\n')].filter(Boolean).map((n) => n.toLowerCase()))],
  }));
}

async function certspotter(domain, { subdomains, withDer, pages = 4 }) {
  const out = [];
  let after = null;
  for (let p = 0; p < pages; p++) {
    const params = new URLSearchParams({ domain, include_subdomains: String(!!subdomains), match_wildcards: 'true' });
    params.append('expand', 'dns_names');
    params.append('expand', 'issuer');
    if (withDer) params.append('expand', 'cert_der');
    if (after) params.set('after', after);
    const res = await fetch(`https://api.certspotter.com/v1/issuances?${params}`, { signal: AbortSignal.timeout(20000) });
    if (res.status === 429) { if (out.length) break; throw new Error('Cert Spotter rate limit reached (free tier). Try again later or use crt.sh.'); }
    if (!res.ok) throw new Error(`Cert Spotter returned HTTP ${res.status}`);
    const rows = await res.json();
    out.push(...rows.map((r) => ({
      id: r.id,
      source: 'Cert Spotter',
      link: `https://crt.sh/?sha256=${r.cert_sha256}`,
      issuer: r.issuer?.friendly_name || issuerShort(r.issuer?.name || ''),
      issuerFull: r.issuer?.name || '',
      notBefore: utc(r.not_before),
      notAfter: utc(r.not_after),
      revoked: r.revoked,
      sha256: r.cert_sha256,
      der: r.cert_der,
      names: (r.dns_names || []).map((n) => n.toLowerCase()),
    })));
    if (rows.length < 100) break;
    after = rows[rows.length - 1].id;
  }
  return out;
}

/**
 * Searches CT logs for certificates covering `domain`.
 * source: 'auto' tries crt.sh first and falls back to Cert Spotter when it is slow or down.
 */
export async function ctSearch(domain, { source = 'auto', subdomains = true, includeExpired = false, withDer = false } = {}) {
  const errors = [];
  const order = source === 'auto' ? ['crt.sh', 'certspotter'] : [source];
  for (const s of order) {
    try {
      const certs = s === 'crt.sh'
        ? await crtsh(domain, { subdomains, includeExpired, timeout: source === 'auto' ? 25000 : 60000 })
        : await certspotter(domain, { subdomains, withDer });
      return { certs, source: s === 'crt.sh' ? 'crt.sh' : 'Cert Spotter', errors };
    } catch (e) {
      errors.push(`${s}: ${e.name === 'TimeoutError' ? 'timed out' : e.message}`);
    }
  }
  throw new Error(`All CT sources failed — ${errors.join(' · ')}`);
}

/** Collapses certificates into one row per hostname. */
export function hostnamesFromCerts(certs, domain) {
  const map = new Map();
  const suffix = `.${domain}`;
  for (const c of certs) {
    for (const raw of c.names) {
      const name = raw.replace(/\.$/, '');
      if (name !== domain && !name.endsWith(suffix)) continue;
      const row = map.get(name) || { name, wildcard: name.startsWith('*.'), certs: 0, firstSeen: c.notBefore, lastExpiry: c.notAfter, issuers: new Set() };
      row.certs++;
      if (c.notBefore < row.firstSeen) row.firstSeen = c.notBefore;
      if (c.notAfter > row.lastExpiry) row.lastExpiry = c.notAfter;
      row.issuers.add(c.issuer);
      map.set(name, row);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
