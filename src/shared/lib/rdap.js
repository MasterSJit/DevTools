// RDAP (the JSON successor of WHOIS) straight from the browser.
// IANA's bootstrap files and the registries' RDAP servers all send `Access-Control-Allow-Origin: *`.
import { isIPv4, isIPv6, cidrContains } from './ip';

const BOOTSTRAP = {
  dns: 'https://data.iana.org/rdap/dns.json',
  ipv4: 'https://data.iana.org/rdap/ipv4.json',
  ipv6: 'https://data.iana.org/rdap/ipv6.json',
  asn: 'https://data.iana.org/rdap/asn.json',
};

const cache = {};

async function bootstrap(kind) {
  if (cache[kind]) return cache[kind];
  const key = `devforge-rdap-${kind}`;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (saved) return (cache[kind] = saved);
  } catch {}
  const res = await fetch(BOOTSTRAP[kind]);
  if (!res.ok) throw new Error(`Could not load the IANA RDAP bootstrap (${res.status})`);
  const data = (await res.json()).services;
  try { sessionStorage.setItem(key, JSON.stringify(data)); } catch {}
  return (cache[kind] = data);
}

const pickUrl = (urls) => (urls.find((u) => u.startsWith('https://')) || urls[0]).replace(/\/?$/, '/');

/** Detects what the user typed: domain, IPv4/6, ASN — also accepts URLs and e-mail addresses. */
export function classifyQuery(raw) {
  let q = raw.trim();
  if (!q) return null;
  if (/^as\d+$/i.test(q) || /^\d{1,10}$/.test(q)) return { type: 'autnum', value: q.replace(/^as/i, '') };
  try { if (/^[a-z][a-z0-9+.-]*:\/\//i.test(q)) q = new URL(q).hostname; } catch {}
  if (q.includes('@') && !q.includes(':')) q = q.split('@').pop();
  q = q.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (isIPv4(q)) return { type: 'ip', value: q, family: 4 };
  if (isIPv6(q)) return { type: 'ip', value: q, family: 6 };
  if (/^[a-z0-9¡-￿-]+(\.[a-z0-9¡-￿-]+)+$/i.test(q)) return { type: 'domain', value: q };
  throw new Error('Enter a domain, IP address or ASN (e.g. example.com, 8.8.8.8, AS15169)');
}

async function serverFor(query) {
  if (query.type === 'domain') {
    const services = await bootstrap('dns');
    const labels = new URL(`http://${query.value}`).hostname.split('.');
    // Longest matching suffix wins (bootstrap entries are mostly TLDs)
    for (let i = 0; i < labels.length; i++) {
      const suffix = labels.slice(i).join('.');
      const hit = services.find(([tlds]) => tlds.includes(suffix));
      if (hit) return { base: pickUrl(hit[1]), path: `domain/${new URL(`http://${query.value}`).hostname}`, zone: suffix };
    }
    return { base: null, zone: labels[labels.length - 1] };
  }
  if (query.type === 'ip') {
    const services = await bootstrap(query.family === 4 ? 'ipv4' : 'ipv6');
    const hit = services.find(([cidrs]) => cidrs.some((c) => cidrContains(c, query.value)));
    return { base: hit ? pickUrl(hit[1]) : 'https://rdap.org/', path: `ip/${query.value}` };
  }
  const n = Number(query.value);
  const services = await bootstrap('asn');
  const hit = services.find(([ranges]) => ranges.some((r) => { const [a, b = a] = r.split('-').map(Number); return n >= a && n <= b; }));
  return { base: hit ? pickUrl(hit[1]) : 'https://rdap.org/', path: `autnum/${n}` };
}

export async function rdapLookup(query) {
  const server = await serverFor(query);
  if (!server.base) {
    const err = new Error(`.${server.zone} has no public RDAP service — it only offers legacy port-43 WHOIS.`);
    err.noRdap = true;
    err.zone = server.zone;
    throw err;
  }
  // Subdomains (www.example.com, api.example.co.uk) have no registration of their own:
  // walk up one label at a time until the registry knows the name.
  const candidates = [server.path];
  if (query.type === 'domain') {
    const labels = server.path.slice('domain/'.length).split('.');
    const zoneLabels = server.zone.split('.').length;
    for (let i = 1; labels.length - i > zoneLabels; i++) candidates.push(`domain/${labels.slice(i).join('.')}`);
  }
  for (const path of candidates) {
    const url = server.base + path;
    const res = await fetch(url, { headers: { accept: 'application/rdap+json, application/json' } });
    if (res.status === 404) continue;
    if (res.status === 429) throw new Error('The registry is rate-limiting requests. Try again in a minute.');
    if (!res.ok) throw new Error(`RDAP server returned HTTP ${res.status}`);
    const queried = path.slice(path.indexOf('/') + 1);
    return { url, data: await res.json(), parentOf: path === server.path ? null : query.value, queried };
  }
  throw new Error(query.type === 'domain' ? 'Not found — the domain is probably not registered (or the registry hides it from RDAP).' : 'No RDAP record found.');
}

/** Follows the registrar's own RDAP record (thin registries like .com keep contacts there). Best effort. */
export async function rdapRelated(data) {
  const link = (data.links || []).find((l) => l.rel === 'related' && /application\/rdap\+json/.test(l.type || '') && l.href);
  if (!link) return null;
  try {
    const res = await fetch(link.href, { headers: { accept: 'application/rdap+json' }, signal: AbortSignal.timeout(8000) });
    return res.ok ? { url: link.href, data: await res.json() } : null;
  } catch { return null; }
}

// ── Normalisation ──
function vcard(entity) {
  const props = entity?.vcardArray?.[1] || [];
  const get = (name) => props.filter((p) => p[0] === name).map((p) => p[3]);
  const adr = get('adr')[0];
  return {
    name: get('fn')[0] || '',
    org: [].concat(get('org')[0] || '').join(' '),
    email: get('email')[0] || '',
    phone: (get('tel')[0] || '').replace(/^tel:/, ''),
    address: Array.isArray(adr) ? adr.flat().filter(Boolean).join(', ') : (props.find((p) => p[0] === 'adr')?.[1]?.label || ''),
  };
}

function flattenEntities(entities = [], out = []) {
  for (const e of entities) { out.push(e); flattenEntities(e.entities, out); }
  return out;
}

export function summarize(data) {
  const ev = Object.fromEntries((data.events || []).map((e) => [e.eventAction, e.eventDate]));
  const entities = flattenEntities(data.entities);
  const byRole = (role) => entities.filter((e) => (e.roles || []).includes(role));
  const contacts = entities
    .filter((e) => e.vcardArray)
    .map((e) => ({ roles: e.roles || [], handle: e.handle, ...vcard(e) }))
    .filter((c) => c.name || c.org || c.email);
  const registrar = byRole('registrar')[0];
  const abuse = contacts.find((c) => c.roles.includes('abuse'));
  return {
    kind: data.objectClassName,
    name: data.unicodeName || data.ldhName || data.name || data.handle,
    ldhName: data.ldhName,
    handle: data.handle,
    status: data.status || [],
    created: ev.registration,
    updated: ev['last changed'],
    expires: ev.expiration,
    transfer: ev.transfer,
    registrar: registrar ? { ...vcard(registrar), ianaId: registrar.publicIds?.find((p) => /iana/i.test(p.type))?.identifier } : null,
    abuse,
    contacts,
    nameservers: (data.nameservers || []).map((n) => (n.ldhName || n.unicodeName || '').toLowerCase()),
    dnssec: data.secureDNS ? !!data.secureDNS.delegationSigned : null,
    // IP network / ASN fields
    range: data.startAddress ? `${data.startAddress} – ${data.endAddress}` : data.startAutnum ? `AS${data.startAutnum} – AS${data.endAutnum}` : null,
    cidrs: (data.cidr0_cidrs || []).map((c) => `${c.v4prefix || c.v6prefix}/${c.length}`),
    country: data.country,
    netType: data.type,
    parent: data.parentHandle,
    remarks: (data.remarks || []).flatMap((r) => r.description || []).slice(0, 6),
  };
}

const DAY = 86400000;

/** Security / hygiene findings for a domain record. */
export function domainFindings(s) {
  const f = [];
  const now = Date.now();
  const status = s.status.map((x) => x.toLowerCase());
  if (s.expires) {
    const days = Math.floor((new Date(s.expires) - now) / DAY);
    if (days < 0) f.push({ level: 'critical', title: 'Domain registration has expired', detail: `Expired ${-days} days ago — it can be taken over by anyone once released.`, fix: 'renew' });
    else if (days < 30) f.push({ level: 'high', title: `Expires in ${days} days`, detail: 'Renew now and enable auto-renew to avoid an outage or domain hijack.', fix: 'renew' });
    else if (days < 90) f.push({ level: 'low', title: `Expires in ${days} days`, detail: 'Make sure auto-renew is on.', fix: 'renew' });
    else f.push({ level: 'pass', title: `Registered until ${new Date(s.expires).toDateString()}` });
  }
  if (s.created) {
    const age = Math.floor((now - new Date(s.created)) / DAY);
    if (age < 30) f.push({ level: 'medium', title: `Newly registered (${age} days old)`, detail: 'Most phishing domains are used within days of registration — be careful with links to it.' });
  }
  if (!status.some((x) => x.includes('client transfer prohibited') || x.includes('server transfer prohibited'))) {
    f.push({ level: 'medium', title: 'No transfer lock', detail: 'Enable “clientTransferProhibited” (registrar lock) to block unauthorised transfers.', fix: 'transfer-lock' });
  } else f.push({ level: 'pass', title: 'Transfer lock enabled' });
  if (status.some((x) => x.includes('hold'))) f.push({ level: 'high', title: 'Domain is on hold', detail: 'serverHold/clientHold means it is removed from DNS and will not resolve.' });
  if (status.some((x) => x.includes('pending delete') || x.includes('redemption'))) f.push({ level: 'critical', title: 'Domain is being deleted', detail: 'It is in the redemption / pending-delete phase.' });
  if (s.dnssec === false) f.push({ level: 'low', title: 'DNSSEC not enabled', detail: 'DNS answers for this domain are not cryptographically signed.', fix: 'dnssec' });
  if (s.dnssec === true) f.push({ level: 'pass', title: 'DNSSEC enabled' });
  return f;
}

export const prettyStatus = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
