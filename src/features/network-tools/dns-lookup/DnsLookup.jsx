import { useState } from 'react';
import {
  Stack, Group, Button, Text, TextInput, Table, Badge, Tabs, MultiSelect, SegmentedControl, Alert, SimpleGrid, Code, Loader,
} from '@mantine/core';
import { IconSearch, IconMailCheck, IconWorld } from '@tabler/icons-react';
import CopyButton from '@/shared/components/CopyButton';
import { Panel, FindingList, Grade } from '@/shared/components/ui';
import FixGuides from '@/shared/components/FixGuides';
import { parseDer, decodeSpki } from '@/shared/lib/asn1';
import { base64ToBytes } from '@/shared/lib/encoding';

const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'CAA', 'SRV', 'PTR', 'DS', 'DNSKEY', 'HTTPS'];
const TYPE_NUM = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 43: 'DS', 48: 'DNSKEY', 65: 'HTTPS', 257: 'CAA' };
const RESOLVERS = {
  cloudflare: (name, type) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
  google: (name, type) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
};
const RCODES = { 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 5: 'REFUSED' };

async function query(resolver, name, type) {
  const res = await fetch(RESOLVERS[resolver](name, type), { headers: { accept: 'application/dns-json' } });
  if (!res.ok) throw new Error(`Resolver returned HTTP ${res.status}`);
  return res.json();
}

const cleanTxt = (data) => data.replace(/^"|"$/g, '').replace(/"\s*"/g, '');

function normalizeDomain(input) {
  let d = input.trim().toLowerCase();
  try { if (/^[a-z]+:\/\//.test(d)) d = new URL(d).hostname; } catch {}
  return d.replace(/\.$/, '');
}

function reverseName(ip) {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return `${ip.split('.').reverse().join('.')}.in-addr.arpa`;
  return null;
}

function Records() {
  const [domain, setDomain] = useState('example.com');
  const [types, setTypes] = useState(['A', 'AAAA', 'MX', 'TXT', 'NS']);
  const [resolver, setResolver] = useState('cloudflare');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true); setError(null);
    try {
      let name = normalizeDomain(domain);
      const ptr = reverseName(name);
      const list = ptr ? ['PTR'] : types;
      if (ptr) name = ptr;
      const out = await Promise.all(list.map(async (t) => ({ type: t, ...(await query(resolver, name, t)) })));
      setResults({ name, list: out });
    } catch (e) { setError(`${e.message}. Your network or an extension may block DNS-over-HTTPS.`); setResults(null); }
    setBusy(false);
  };

  return (
    <Stack gap="md">
      <Panel>
        <Group align="flex-end" wrap="wrap">
          <TextInput label="Domain or IPv4 (for PTR)" value={domain} onChange={(e) => setDomain(e.currentTarget.value)} w={260}
            onKeyDown={(e) => e.key === 'Enter' && run()} />
          <MultiSelect label="Record types" data={TYPES} value={types} onChange={setTypes} w={340} clearable searchable />
          <SegmentedControl value={resolver} onChange={setResolver} data={[{ value: 'cloudflare', label: 'Cloudflare' }, { value: 'google', label: 'Google' }]} />
          <Button leftSection={<IconSearch size={16} />} onClick={run} loading={busy} disabled={!domain.trim()}>Look up</Button>
        </Group>
      </Panel>
      {error && <Alert color="red">{error}</Alert>}
      {results && results.list.map((r) => (
        <Panel key={r.type} title={r.type} actions={<>
          {r.AD && <Badge size="xs" color="teal" variant="light">DNSSEC validated</Badge>}
          <Badge size="xs" variant="light" color={r.Status === 0 ? 'gray' : 'red'}>{RCODES[r.Status] || r.Status}</Badge>
        </>}>
          {r.Answer?.length ? (
            <Table verticalSpacing={4} striped>
              <Table.Tbody>
                {r.Answer.map((a, i) => (
                  <Table.Tr key={i}>
                    <Table.Td w={70}><Badge size="xs" variant="outline">{TYPE_NUM[a.type] || a.type}</Badge></Table.Td>
                    <Table.Td><Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>{a.type === 16 ? cleanTxt(a.data) : a.data}</Text></Table.Td>
                    <Table.Td w={80}><Text size="xs" c="dimmed">TTL {a.TTL}</Text></Table.Td>
                    <Table.Td w={36}><CopyButton value={a.data} icon /></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : <Text size="sm" c="dimmed">No {r.type} records.</Text>}
        </Panel>
      ))}
    </Stack>
  );
}

function analyzeSpf(spf) {
  const f = [];
  if (!spf.length) return [{ level: 'high', title: 'No SPF record', detail: 'Anyone can send mail claiming to be from this domain. Add a TXT record like: v=spf1 include:_spf.google.com -all' }];
  if (spf.length > 1) f.push({ level: 'high', title: 'Multiple SPF records', detail: 'RFC 7208 makes this a permanent error — SPF will fail for every message.' });
  const rec = spf[0];
  const all = (rec.match(/([-~?+]?)all\b/) || [])[1];
  if (all === undefined) f.push({ level: 'medium', title: 'SPF has no “all” mechanism', detail: 'Unlisted senders are treated as neutral.' });
  else if (all === '+' || all === '') f.push({ level: 'critical', title: 'SPF ends with +all', detail: 'Explicitly authorizes the entire internet to send as you.' });
  else if (all === '?') f.push({ level: 'medium', title: 'SPF ends with ?all (neutral)', detail: 'Provides no protection.' });
  else if (all === '~') f.push({ level: 'low', title: 'SPF ends with ~all (softfail)', detail: 'OK during rollout; -all is stricter once DMARC is enforced.' });
  else f.push({ level: 'pass', title: 'SPF ends with -all (hard fail)' });
  const lookups = (rec.match(/\b(include|a|mx|ptr|exists|redirect)[:=]?/g) || []).length;
  if (lookups > 10) f.push({ level: 'high', title: `~${lookups} DNS-lookup mechanisms (limit 10)`, detail: 'Exceeding 10 lookups causes SPF permerror.' });
  if (/\bptr\b/.test(rec)) f.push({ level: 'low', title: 'Uses deprecated ptr mechanism' });
  return f;
}

function analyzeDmarc(dmarc) {
  if (!dmarc) return [{ level: 'high', title: 'No DMARC record', detail: 'Add _dmarc TXT: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain' }];
  const tags = Object.fromEntries(dmarc.split(';').map((p) => p.trim().split('=')).filter((p) => p[0]).map(([k, v]) => [k.toLowerCase(), (v || '').trim()]));
  const f = [];
  if (tags.p === 'none') f.push({ level: 'medium', title: 'DMARC policy is p=none', detail: 'Monitoring only — spoofed mail is still delivered.' });
  else if (tags.p === 'quarantine') f.push({ level: 'pass', title: 'DMARC p=quarantine', detail: 'Spoofed mail goes to spam. Move to p=reject when confident.' });
  else if (tags.p === 'reject') f.push({ level: 'pass', title: 'DMARC p=reject', detail: 'Strongest protection.' });
  else f.push({ level: 'high', title: 'Invalid or missing DMARC p= tag' });
  if (tags.pct && Number(tags.pct) < 100) f.push({ level: 'low', title: `Policy applies to only ${tags.pct}% of mail` });
  if (!tags.rua) f.push({ level: 'low', title: 'No aggregate reports (rua)', detail: 'You will not see who is sending as your domain.' });
  if (tags.sp === 'none' && tags.p !== 'none') f.push({ level: 'low', title: 'Subdomain policy sp=none', detail: 'Subdomains can still be spoofed.' });
  return f;
}

// DKIM selectors can't be listed through DNS, so we try the ones each detected sender uses plus common defaults.
const COMMON_SELECTORS = ['default', 'dkim', 'mail', 'k1', 's1', 's2', 'selector1', 'selector2', 'google', 'key1', 'smtp'];
const PROVIDERS = [
  [/_spf\.google\.com|google\.com|googlemail/i, 'Google Workspace', ['google']],
  [/protection\.outlook\.com|outlook\.com|^ms=/i, 'Microsoft 365', ['selector1', 'selector2']],
  [/brevo|sendinblue/i, 'Brevo', ['brevo1', 'brevo2', 'mail']],
  [/sendgrid/i, 'SendGrid', ['s1', 's2', 'smtpapi']],
  [/mailgun/i, 'Mailgun', ['mx', 'k1', 'smtp', 'krs', 'pic']],
  [/zoho/i, 'Zoho Mail', ['zmail', 'zoho']],
  [/mcsv\.net|mandrillapp|mailchimp/i, 'Mailchimp / Mandrill', ['k1', 'k2', 'k3', 'mandrill']],
  [/mtasv\.net|postmark/i, 'Postmark', ['pm']],
  [/mailjet/i, 'Mailjet', ['mailjet']],
  [/protonmail|proton\.me/i, 'Proton Mail', ['protonmail', 'protonmail2', 'protonmail3']],
  [/messagingengine|fastmail/i, 'Fastmail', ['fm1', 'fm2', 'fm3']],
  [/hubspot/i, 'HubSpot', ['hs1', 'hs2']],
  [/amazonses/i, 'Amazon SES', []],
];

function dkimKeyInfo(record) {
  const tags = Object.fromEntries(record.split(';').map((p) => p.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k.toLowerCase(), v.join('=').trim()]));
  if (tags.p === '') return { revoked: true };
  if ((tags.k || 'rsa').toLowerCase() === 'ed25519') return { type: 'Ed25519', bits: 256 };
  try { return { type: 'RSA', bits: decodeSpki(parseDer(base64ToBytes(tags.p))).bits }; } catch { return { type: tags.k || 'rsa', bits: null }; }
}

function EmailSecurity() {
  const [domain, setDomain] = useState('serversbay.com');
  const [selectors, setSelectors] = useState('');
  const [r, setR] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const txt = async (name) => ((await query('cloudflare', name, 'TXT')).Answer || []).filter((a) => a.type === 16).map((a) => cleanTxt(a.data));

  const run = async () => {
    setBusy(true); setError(null);
    try {
      const d = normalizeDomain(domain);
      const [rootTxt, dmarcTxt, mx, caa, mtaSts, tlsRpt, bimi] = await Promise.all([
        txt(d), txt(`_dmarc.${d}`), query('cloudflare', d, 'MX'), query('cloudflare', d, 'CAA'),
        txt(`_mta-sts.${d}`), txt(`_smtp._tls.${d}`), txt(`default._bimi.${d}`),
      ]);
      // Detect senders from SPF includes, MX hosts and verification TXT records
      const evidence = [...rootTxt, ...(mx.Answer || []).map((a) => a.data)].join(' ');
      const providers = PROVIDERS.filter(([re]) => re.test(evidence));
      const sels = [...new Set([
        ...selectors.split(/[\s,]+/).filter(Boolean),
        ...providers.flatMap(([, , s]) => s),
        ...COMMON_SELECTORS,
      ])].slice(0, 30);
      const dkim = await Promise.all(sels.map((s) => txt(`${s}._domainkey.${d}`)
        .then((v) => ({ selector: s, records: v.filter((x) => /v=DKIM1|k=(rsa|ed25519)|p=/i.test(x)) }))
        .catch(() => ({ selector: s, records: [] }))));
      const spf = rootTxt.filter((t) => /^v=spf1/i.test(t));
      const dmarc = dmarcTxt.find((t) => /^v=DMARC1/i.test(t));
      const dkimFound = dkim.filter((k) => k.records.length).map((k) => ({ ...k, key: dkimKeyInfo(k.records[0]) }));
      const weakKeys = dkimFound.filter((k) => k.key.bits && k.key.type === 'RSA' && k.key.bits < 2048);
      const withFix = (list, fix) => list.map((f) => (f.level === 'pass' ? f : { ...f, fix }));
      const hasMx = (mx.Answer || []).length > 0;
      const findings = [
        ...withFix(analyzeSpf(spf), hasMx ? 'spf' : 'null-mail'),
        ...withFix(analyzeDmarc(dmarc), hasMx ? 'dmarc' : 'null-mail'),
        dkimFound.length
          ? { level: 'pass', title: `DKIM found for selector(s): ${dkimFound.map((k) => k.selector).join(', ')}` }
          : { level: hasMx || spf.length ? 'medium' : 'info', title: `No DKIM key found (tried ${sels.length} selectors)`, detail: 'DKIM selectors are not public — if you do sign mail, open a received e-mail’s headers and look for “s=” in the DKIM-Signature line, then enter it above.', fix: hasMx || spf.length ? 'dkim' : undefined },
        ...weakKeys.map((k) => ({ level: k.key.bits < 1024 ? 'high' : 'low', title: `DKIM key “${k.selector}” is only ${k.key.bits}-bit RSA`, detail: 'Use 2048-bit keys — 1024-bit RSA is considered weak.', fix: 'dkim' })),
        hasMx ? { level: 'pass', title: `${mx.Answer.length} MX record(s)` } : { level: 'info', title: 'No MX records', detail: 'Domain does not receive mail. Consider “v=spf1 -all” and DMARC p=reject to block spoofing.', fix: 'null-mail' },
        mtaSts.some((t) => /v=STSv1/i.test(t)) ? { level: 'pass', title: 'MTA-STS enabled' } : hasMx ? { level: 'low', title: 'No MTA-STS', detail: 'Inbound SMTP TLS can be downgraded by an attacker.', fix: 'mta-sts' } : null,
        tlsRpt.length ? { level: 'pass', title: 'SMTP TLS reporting (TLS-RPT) enabled' } : hasMx ? { level: 'info', title: 'No TLS-RPT record', fix: 'tls-rpt' } : null,
        (caa.Answer || []).some((a) => a.type === 257) ? { level: 'pass', title: 'CAA restricts which CAs may issue certificates' } : { level: 'low', title: 'No CAA record', detail: 'Any certificate authority may issue certificates for this domain.', fix: 'caa' },
        bimi.length ? { level: 'pass', title: 'BIMI logo record present' } : null,
      ].filter(Boolean);
      const penalty = { critical: 30, high: 20, medium: 10, low: 4, info: 0, pass: 0 };
      const score = Math.max(0, 100 - findings.reduce((n, x) => n + penalty[x.level], 0));
      setR({
        domain: d, spf, dmarc, mx: mx.Answer || [], caa: (caa.Answer || []).filter((a) => a.type === 257), dkim: dkimFound, findings, score,
        providers: providers.map(([, name]) => name), tried: sels,
      });
    } catch (e) { setError(e.message); setR(null); }
    setBusy(false);
  };

  const grade = (s) => (s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 60 ? 'C' : s >= 40 ? 'D' : 'F');

  return (
    <Stack gap="md">
      <Panel>
        <Group align="flex-end" wrap="wrap">
          <TextInput label="Domain" value={domain} onChange={(e) => setDomain(e.currentTarget.value)} w={240} onKeyDown={(e) => e.key === 'Enter' && run()} />
          <TextInput label="Extra DKIM selectors (optional)" placeholder="auto-detected from your mail providers" value={selectors}
            onChange={(e) => setSelectors(e.currentTarget.value)} w={300} />
          <Button leftSection={<IconMailCheck size={16} />} onClick={run} loading={busy}>Check e-mail security</Button>
          {busy && <Loader size="xs" />}
        </Group>
      </Panel>
      {error && <Alert color="red">{error}</Alert>}
      {r && (
        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          <Panel title={`Results for ${r.domain}`}>
            <Grade grade={grade(r.score)} label={`Spoofing-protection score ${r.score}/100`} />
            {r.providers.length > 0 && (
              <Group gap={4} mt="sm">
                <Text size="xs" c="dimmed">Mail senders detected:</Text>
                {r.providers.map((p) => <Badge key={p} size="sm" variant="light" tt="none">{p}</Badge>)}
              </Group>
            )}
            <div className="mt-3"><FindingList findings={r.findings} /></div>
            <Text size="xs" c="dimmed" mt="xs">DKIM selectors tried: {r.tried.join(', ')}</Text>
          </Panel>
          <Stack gap="md">
            <Panel title="SPF">{r.spf.length ? r.spf.map((s, i) => <Code key={i} block>{s}</Code>) : <Text size="sm" c="dimmed">None</Text>}</Panel>
            <Panel title="DMARC">{r.dmarc ? <Code block>{r.dmarc}</Code> : <Text size="sm" c="dimmed">None</Text>}</Panel>
            <Panel title="MX">{r.mx.length ? r.mx.map((m, i) => <Text key={i} size="xs" ff="monospace">{m.data}</Text>) : <Text size="sm" c="dimmed">None</Text>}</Panel>
            {r.dkim.map((k) => (
              <Panel key={k.selector} title={`DKIM · ${k.selector}._domainkey`} actions={
                <Badge size="sm" variant="light" color={k.key.revoked ? 'gray' : k.key.bits && k.key.bits < 2048 && k.key.type === 'RSA' ? 'orange' : 'teal'}>
                  {k.key.revoked ? 'revoked' : `${k.key.type}${k.key.bits ? ` ${k.key.bits}-bit` : ''}`}
                </Badge>
              }>
                <Code block style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{k.records[0]}</Code>
              </Panel>
            ))}
            {r.caa.length > 0 && <Panel title="CAA">{r.caa.map((c, i) => <Text key={i} size="xs" ff="monospace">{c.data}</Text>)}</Panel>}
          </Stack>
        </SimpleGrid>
      )}
      {r && <FixGuides findings={r.findings} title={`How to fix ${r.domain} — step by step`} />}
    </Stack>
  );
}

export default function DnsLookup() {
  const [tab, setTab] = useState('records');
  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="records" leftSection={<IconWorld size={14} />}>DNS records</Tabs.Tab>
          <Tabs.Tab value="email" leftSection={<IconMailCheck size={14} />}>E-mail security (SPF / DMARC / DKIM)</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'records' ? <Records /> : <EmailSecurity />}
      <Text size="xs" c="orange">
        This tool sends the domain name you enter to a public DNS-over-HTTPS resolver (Cloudflare 1.1.1.1 or Google 8.8.8.8). Nothing else leaves your browser.
      </Text>
    </Stack>
  );
}
