import { useMemo, useState } from 'react';
import {
  Stack, Group, Button, Text, TextInput, Badge, SimpleGrid, Alert, Table, SegmentedControl, Switch, ScrollArea, Tooltip, Progress,
} from '@mantine/core';
import { IconSearch, IconWorldSearch, IconDownload, IconRadar } from '@tabler/icons-react';
import CopyButton from '@/shared/components/CopyButton';
import { Panel, Stat } from '@/shared/components/ui';
import { ctSearch, hostnamesFromCerts } from '@/shared/lib/ct';
import { downloadText } from '@/shared/lib/download';
import FixGuides from '@/shared/components/FixGuides';

// Names that usually deserve a second look when they are publicly discoverable
const SENSITIVE = /(dev|stag|stg|test|uat|qa|sandbox|admin|internal|intranet|vpn|jenkins|gitlab|git|db|sql|backup|old|legacy|beta|debug|cpanel|whm|panel|grafana|kibana|jira|confluence)/i;
// Only the part in front of the registered domain is checked
const isSensitive = (name, domain) => SENSITIVE.test(name.slice(0, Math.max(0, name.length - domain.length - 1)));
// Services where a CNAME to a deleted resource can be claimed by someone else
const TAKEOVER_PRONE = /\.(github\.io|herokuapp\.com|herokudns\.com|azurewebsites\.net|cloudapp\.net|trafficmanager\.net|blob\.core\.windows\.net|s3[.-][\w-]*\.amazonaws\.com|s3\.amazonaws\.com|elasticbeanstalk\.com|cloudfront\.net|fastly\.net|ghost\.io|myshopify\.com|surge\.sh|bitbucket\.io|readthedocs\.io|netlify\.app|vercel\.app|pantheonsite\.io|zendesk\.com|wpengine\.com|webflow\.io|unbouncepages\.com)\.?$/i;

const fmt = (d) => (d ? d.toISOString().slice(0, 10) : '—');

// Hosts covered only by a wildcard certificate never appear by name in CT logs,
// so a short list of very common names is also checked in DNS.
const COMMON_NAMES = `www mail webmail smtp imap pop mx autodiscover ns1 ns2 api app apps admin portal dashboard panel cpanel whm
dev staging stage test beta demo uat qa sandbox docs help support status blog shop store cdn static assets img images media files
upload download vpn remote git gitlab jenkins ci monitor grafana db mysql phpmyadmin auth sso login accounts id m mobile forum wiki
crm erp intranet internal old new backup ftp sftp cloud analytics news events careers jobs pay billing partners`.split(/\s+/);

async function resolve(name) {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=A`, { headers: { accept: 'application/dns-json' } });
  const j = await res.json();
  const answers = j.Answer || [];
  const cname = answers.filter((a) => a.type === 5).map((a) => a.data.replace(/\.$/, ''));
  const ips = answers.filter((a) => a.type === 1).map((a) => a.data);
  const target = cname[cname.length - 1];
  // CNAME chain ends in NXDOMAIN → the target was deleted but the record still points at it
  const dangling = cname.length > 0 && ips.length === 0 && j.Status === 3;
  return { status: j.Status, ips, cname, dangling, takeoverProne: dangling && target && TAKEOVER_PRONE.test(target) };
}

const fingerprint = (r) => `${r.cname.join(',')}|${[...r.ips].sort().join(',')}`;

async function dnsAnswers(name, type) {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: 'application/dns-json' } });
  return (await res.json()).Answer || [];
}

// Hostnames the domain's own DNS reveals: MX / NS targets, common SRV services, www's CNAME target.
const SRV_SERVICES = ['_autodiscover._tcp', '_submission._tcp', '_imaps._tcp', '_imap._tcp', '_pop3s._tcp', '_sip._tls', '_sip._tcp',
  '_sipfederationtls._tcp', '_xmpp-server._tcp', '_caldavs._tcp', '_carddavs._tcp', '_ldap._tcp', '_kerberos._tcp'];

async function harvestFromDns(d) {
  const lists = await Promise.all([
    dnsAnswers(d, 'MX'), dnsAnswers(d, 'NS'), dnsAnswers(`www.${d}`, 'CNAME'),
    ...SRV_SERVICES.map((s) => dnsAnswers(`${s}.${d}`, 'SRV').catch(() => [])),
  ]);
  const names = new Set();
  for (const a of lists.flat()) {
    const target = String(a.data).trim().split(/\s+/).pop().replace(/\.$/, '').toLowerCase();
    if (target.endsWith(`.${d}`)) names.add(target);
  }
  return names;
}

export default function SubdomainFinder() {
  const [domain, setDomain] = useState('serversbay.com');
  const [source, setSource] = useState('auto');
  const [includeExpired, setIncludeExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [dns, setDns] = useState({});
  const [dnsProgress, setDnsProgress] = useState(null);
  const [guess, setGuess] = useState(true);
  const [stage, setStage] = useState('');

  const guessCommon = async (d, known) => {
    // With wildcard DNS (*.domain resolves) every guess "exists", so only names that resolve
    // differently from the wildcard are real, separate records.
    const probe = await resolve(`df-${Math.random().toString(36).slice(2, 10)}.${d}`).catch(() => null);
    const wildcard = probe && (probe.ips.length || probe.cname.length) ? fingerprint(probe) : null;
    const fromDns = await harvestFromDns(d).catch(() => new Set());
    const queue = [...new Set([...fromDns, ...COMMON_NAMES.map((n) => `${n}.${d}`)])].filter((n) => !known.has(n));
    const found = [];
    const results = {};
    const worker = async () => {
      while (queue.length) {
        const n = queue.shift();
        try {
          const r = await resolve(n);
          const exists = r.ips.length || r.cname.length;
          if (exists && (fromDns.has(n) || !wildcard || fingerprint(r) !== wildcard)) { found.push(n); results[n] = r; }
        } catch { /* ignore */ }
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    return { wildcardDns: !!wildcard, found, results, fromDns: [...fromDns] };
  };

  const run = async () => {
    setBusy(true); setError(null); setResult(null); setDns({}); setDnsProgress(null);
    try {
      const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\*\./, '').replace(/^www\./, '');
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) throw new Error('Enter a registered domain like example.com');
      setStage('Searching Certificate Transparency logs…');
      const ct = await ctSearch(d, { source, subdomains: true, includeExpired }).catch((e) => ({ certs: [], source: '—', errors: [e.message] }));
      const hosts = hostnamesFromCerts(ct.certs, d);
      let extra = { found: [], wildcardDns: false, results: {} };
      if (guess) {
        setStage('Checking common subdomain names in DNS…');
        extra = await guessCommon(d, new Set(hosts.map((h) => h.name)));
        extra.found.forEach((n) => hosts.push({ name: n, wildcard: false, certs: 0, firstSeen: null, lastExpiry: null, issuers: new Set(), dnsOnly: true }));
        hosts.sort((a, b) => a.name.localeCompare(b.name));
        setDns(extra.results || {});
      }
      if (!hosts.length && ct.errors.length) throw new Error(ct.errors.join(' · '));
      setResult({ domain: d, certs: ct.certs, hosts, source: ct.source, warnings: ct.errors, wildcardDns: extra.wildcardDns, dnsFound: extra.found.length });
    } catch (e) { setError(e.message); }
    setBusy(false); setStage('');
  };

  const checkDns = async () => {
    const names = result.hosts.filter((h) => !h.wildcard).map((h) => h.name).slice(0, 200);
    setDnsProgress({ done: 0, total: names.length });
    const queue = [...names];
    const worker = async () => {
      while (queue.length) {
        const n = queue.shift();
        let r;
        try { r = await resolve(n); } catch { r = { error: true }; }
        setDns((prev) => ({ ...prev, [n]: r }));
        setDnsProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  };

  const rows = useMemo(() => (result?.hosts || []).filter((h) => h.name.includes(filter.toLowerCase())), [result, filter]);
  const now = new Date();
  const issuers = result ? [...new Set(result.certs.map((c) => c.issuer))] : [];
  const live = Object.values(dns).filter((r) => r.ips?.length).length;
  const dangling = Object.entries(dns).filter(([, r]) => r.dangling);

  const csv = () => ['hostname,first_seen,latest_expiry,certificates,issuers,dns', ...rows.map((h) => {
    const d = dns[h.name];
    return [h.name, fmt(h.firstSeen), fmt(h.lastExpiry), h.certs, `"${[...h.issuers].join('; ')}"`, d ? (d.ips?.join(' ') || d.cname?.join(' ') || 'no record') : ''].join(',');
  })].join('\n');

  return (
    <Stack gap="md">
      <Panel>
        <Group align="flex-end" wrap="wrap">
          <TextInput size="md" label="Domain" value={domain} onChange={(e) => setDomain(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && run()}
            style={{ flex: 1, minWidth: 240 }} className="code-font" placeholder="example.com" />
          <SegmentedControl value={source} onChange={setSource} data={[{ value: 'auto', label: 'Auto' }, { value: 'crt.sh', label: 'crt.sh' }, { value: 'certspotter', label: 'Cert Spotter' }]} />
          <Switch label="Include expired certs" checked={includeExpired} onChange={(e) => setIncludeExpired(e.currentTarget.checked)} mb={8} />
          <Tooltip label="Hosts behind a *.wildcard certificate never appear by name in CT logs — this also tries ~90 common names in DNS">
            <Switch label="Also check common names" checked={guess} onChange={(e) => setGuess(e.currentTarget.checked)} mb={8} />
          </Tooltip>
          <Button size="md" leftSection={<IconSearch size={16} />} onClick={run} loading={busy}>Find subdomains</Button>
        </Group>
        <Text size="xs" c="dimmed" mt="sm">
          Every publicly trusted TLS certificate is published in Certificate Transparency logs — so are the hostnames inside it. Use this to audit what your organisation exposes.
          Large domains can take 20–60 s on crt.sh; Auto falls back to Cert Spotter.
        </Text>
      </Panel>

      {error && <Alert color="red">{error}</Alert>}
      {busy && <Text size="sm" c="dimmed">{stage}</Text>}

      {result && (
        <>
          <SimpleGrid cols={{ base: 2, md: 5 }}>
            <Stat label="Unique hostnames" value={result.hosts.length} />
            <Stat label="Certificates" value={result.certs.length} />
            <Stat label="Wildcards" value={result.hosts.filter((h) => h.wildcard).length} />
            <Stat label="Issuers (CAs)" value={issuers.length} />
            <Stat label="Source" value={result.source} />
          </SimpleGrid>
          {result.warnings.length > 0 && <Alert color="orange" p="xs">{result.warnings.join(' · ')}</Alert>}
          {result.wildcardDns && (
            <Alert color="blue" p="xs">
              <Text size="sm">
                This domain has wildcard DNS (*.{result.domain} resolves), so every name seems to “exist”. Only names that resolve <i>differently</i> from the wildcard
                (or that appear in MX/NS/SRV records) are listed. Hosts proxied through the same CDN as the wildcard look identical from outside — your DNS zone is the only complete list.
              </Text>
            </Alert>
          )}
          {result.dnsFound > 0 && <Text size="xs" c="dimmed">{result.dnsFound} extra hostname(s) found via DNS (marked “DNS”) — from MX/NS/SRV records or common names; they are covered by a wildcard certificate or not using HTTPS.</Text>}
          {dangling.length > 0 && (
            <Alert color="red" title={`${dangling.length} dangling CNAME record(s)`}>
              <Text size="sm">These names point (CNAME) to a target that no longer resolves. If the target is a cloud service, someone else could claim it and serve content on your subdomain (subdomain takeover). Remove the DNS record or reclaim the resource:</Text>
              <Text size="xs" ff="monospace" mt={6}>{dangling.map(([n, r]) => `${n} → ${r.cname[r.cname.length - 1]}${r.takeoverProne ? '  ⚠ takeover-prone service' : ''}`).join('\n')}</Text>
            </Alert>
          )}

          <Panel title={`Hostnames (${rows.length})`} icon={IconWorldSearch} actions={<>
            <TextInput size="xs" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.currentTarget.value)} w={160} />
            <Button size="compact-xs" variant="light" leftSection={<IconRadar size={12} />} onClick={checkDns} disabled={!!dnsProgress && dnsProgress.done < dnsProgress.total}>
              Check DNS
            </Button>
            <CopyButton value={rows.map((h) => h.name).join('\n')} icon />
            <Button size="compact-xs" variant="subtle" leftSection={<IconDownload size={12} />} onClick={() => downloadText(csv(), `${result.domain}-subdomains.csv`, 'text/csv')}>CSV</Button>
          </>}>
            {dnsProgress && (
              <Group gap="xs" mb="xs">
                <Progress value={(dnsProgress.done / Math.max(1, dnsProgress.total)) * 100} style={{ flex: 1 }} size="sm" />
                <Text size="xs" c="dimmed">{dnsProgress.done}/{dnsProgress.total} resolved · {live} live</Text>
              </Group>
            )}
            <ScrollArea.Autosize mah={560}>
              <Table striped verticalSpacing={4} stickyHeader>
                <Table.Thead>
                  <Table.Tr><Table.Th>Hostname</Table.Th><Table.Th>First seen</Table.Th><Table.Th>Latest cert expiry</Table.Th><Table.Th>Certs</Table.Th><Table.Th>DNS</Table.Th></Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((h) => {
                    const d = dns[h.name];
                    const expired = h.lastExpiry && h.lastExpiry < now;
                    return (
                      <Table.Tr key={h.name}>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            <Text size="sm" ff="monospace">{h.name}</Text>
                            {h.wildcard && <Badge size="xs" variant="light" color="grape">wildcard</Badge>}
                            {h.dnsOnly && <Badge size="xs" variant="light" color="cyan">DNS</Badge>}
                            {isSensitive(h.name, result.domain) && <Tooltip label="Admin / dev / internal-looking name that is publicly discoverable — make sure it is meant to be public and protected"><Badge size="xs" variant="light" color="orange">review</Badge></Tooltip>}
                          </Group>
                        </Table.Td>
                        <Table.Td><Text size="xs" c="dimmed">{fmt(h.firstSeen)}</Text></Table.Td>
                        <Table.Td><Text size="xs" c={expired ? 'red' : undefined}>{fmt(h.lastExpiry)}{expired ? ' (expired)' : ''}</Text></Table.Td>
                        <Table.Td><Tooltip label={[...h.issuers].join(', ')}><Text size="xs">{h.certs}</Text></Tooltip></Table.Td>
                        <Table.Td>
                          {!d ? <Text size="xs" c="dimmed">—</Text>
                            : d.error ? <Badge size="xs" color="gray">error</Badge>
                            : d.dangling ? <Badge size="xs" color="red">dangling CNAME</Badge>
                            : d.ips.length ? <Tooltip label={[...d.cname, ...d.ips].join(' → ')}><Badge size="xs" color="teal" variant="light">{d.ips[0]}{d.ips.length > 1 ? ` +${d.ips.length - 1}` : ''}</Badge></Tooltip>
                            : <Badge size="xs" color="gray" variant="light">no record</Badge>}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          </Panel>

          <Panel title="Issuing certificate authorities">
            <Group gap={6}>{issuers.map((i) => <Badge key={i} variant="light" tt="none">{i} × {result.certs.filter((c) => c.issuer === i).length}</Badge>)}</Group>
            {issuers.length > 1 && <Text size="xs" c="dimmed" mt="xs">Multiple CAs issue for this domain. A CAA DNS record can restrict issuance to the CAs you actually use (check it in DNS &amp; Email Security).</Text>}
          </Panel>
          <FixGuides findings={[
            ...dangling.map(([n]) => ({ level: 'high', title: n, fix: 'dangling-cname' })),
            ...(issuers.length > 1 ? [{ level: 'low', title: 'Multiple CAs', fix: 'caa' }] : []),
          ]} />
        </>
      )}
      <Text size="xs" c="dimmed">Queries go directly from your browser to crt.sh / api.certspotter.com and (for “Check DNS”) Cloudflare DNS-over-HTTPS.</Text>
    </Stack>
  );
}
