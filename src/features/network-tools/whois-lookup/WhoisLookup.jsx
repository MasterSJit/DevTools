import { useState } from 'react';
import {
  Stack, Group, Button, Text, TextInput, Badge, SimpleGrid, Alert, Table, Code, Collapse, Anchor, Loader,
} from '@mantine/core';
import { IconSearch, IconWorld, IconServer2, IconShieldCheck, IconCode, IconAddressBook } from '@tabler/icons-react';
import CopyButton from '@/shared/components/CopyButton';
import { Panel, KVTable, FindingList } from '@/shared/components/ui';
import { classifyQuery, rdapLookup, rdapRelated, summarize, domainFindings, prettyStatus } from '@/shared/lib/rdap';
import { legacyWhois, ProxyUnavailableError } from '@/shared/lib/proxy';
import FixGuides from '@/shared/components/FixGuides';

const EXAMPLES = ['serversbay.com', 'google.dev', '8.8.8.8', '2606:4700:4700::1111', 'AS13335'];
const TYPE_LABEL = { domain: 'Domain', ip: 'IP address', autnum: 'ASN' };

const fmtDate = (d) => (d ? new Date(d).toUTCString().replace(' GMT', ' UTC') : '—');
const daysFrom = (d) => (d ? Math.floor((new Date(d) - Date.now()) / 86400000) : null);

function Contacts({ contacts }) {
  if (!contacts.length) return <Text size="sm" c="dimmed">No public contacts (most registries redact personal data under GDPR).</Text>;
  return (
    <Table verticalSpacing={4} striped>
      <Table.Tbody>
        {contacts.map((c, i) => (
          <Table.Tr key={i}>
            <Table.Td w={130} style={{ verticalAlign: 'top' }}>
              <Group gap={4}>{c.roles.map((r) => <Badge key={r} size="xs" variant="light">{r}</Badge>)}</Group>
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={500}>{c.org || c.name}</Text>
              {c.org && c.name && c.name !== c.org && <Text size="xs" c="dimmed">{c.name}</Text>}
              {c.email && <Text size="xs" ff="monospace">{c.email}</Text>}
              {c.phone && <Text size="xs" ff="monospace">{c.phone}</Text>}
              {c.address && <Text size="xs" c="dimmed">{c.address}</Text>}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function DomainView({ s, related }) {
  const days = daysFrom(s.expires);
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title={s.name} icon={IconWorld} actions={days != null && (
          <Badge color={days < 0 ? 'red' : days < 30 ? 'orange' : 'teal'}>{days < 0 ? 'Expired' : `${days} days left`}</Badge>
        )}>
          <KVTable labelWidth={130} rows={[
            s.registrar && ['Registrar', `${s.registrar.name || s.registrar.org}${s.registrar.ianaId ? ` (IANA #${s.registrar.ianaId})` : ''}`, { mono: false }],
            ['Registered', fmtDate(s.created), { mono: false }],
            ['Updated', fmtDate(s.updated), { mono: false }],
            ['Expires', fmtDate(s.expires), { mono: false }],
            ['Nameservers', s.nameservers.join('\n') || '—'],
            ['DNSSEC', s.dnssec == null ? '—' : s.dnssec ? 'Signed' : 'Unsigned', { mono: false }],
            s.abuse?.email && ['Abuse contact', s.abuse.email],
          ]} />
          <Group gap={4} mt="sm">{s.status.map((x) => <Badge key={x} size="sm" variant="outline" tt="none">{prettyStatus(x)}</Badge>)}</Group>
        </Panel>
        <Panel title="Domain health" icon={IconShieldCheck}>
          <FindingList findings={domainFindings(s)} />
        </Panel>
      </SimpleGrid>
      <Panel title="Contacts" icon={IconAddressBook}>
        <Contacts contacts={[...s.contacts, ...(related?.contacts || [])].filter((c, i, a) => a.findIndex((x) => x.email === c.email && x.name === c.name && x.roles.join() === c.roles.join()) === i)} />
        {related && <Text size="xs" c="dimmed" mt="xs">Includes data from the registrar&apos;s own RDAP server.</Text>}
      </Panel>
      <FixGuides findings={domainFindings(s)} />
    </Stack>
  );
}

function NetworkView({ s, type }) {
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }}>
      <Panel title={s.name || s.handle} icon={IconServer2} actions={s.country && <Badge variant="light">{s.country}</Badge>}>
        <KVTable labelWidth={130} rows={[
          ['Handle', s.handle],
          s.range && [type === 'autnum' ? 'ASN range' : 'Range', s.range],
          s.cidrs.length > 0 && ['CIDR', s.cidrs.join(', ')],
          s.netType && ['Type', s.netType, { mono: false }],
          s.parent && ['Parent', s.parent],
          ['Registered', fmtDate(s.created), { mono: false }],
          ['Last changed', fmtDate(s.updated), { mono: false }],
          s.abuse?.email && ['Abuse contact', s.abuse.email],
        ]} />
        {s.remarks.length > 0 && <Text size="xs" c="dimmed" mt="sm" style={{ whiteSpace: 'pre-wrap' }}>{s.remarks.join('\n')}</Text>}
      </Panel>
      <Panel title="Organisation & contacts" icon={IconAddressBook}>
        <Contacts contacts={s.contacts} />
      </Panel>
    </SimpleGrid>
  );
}

export default function WhoisLookup() {
  const [input, setInput] = useState('serversbay.com');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [legacy, setLegacy] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  let detected = null;
  try { detected = classifyQuery(input); } catch {}

  const run = async (value = input) => {
    setBusy(true); setError(null); setResult(null); setLegacy(null);
    try {
      const q = classifyQuery(value);
      const { url, data, parentOf, queried } = await rdapLookup(q);
      const s = summarize(data);
      let related = null;
      if (q.type === 'domain') {
        const rel = await rdapRelated(data);
        if (rel) related = summarize(rel.data);
      }
      setResult({ q, url, data, s, related, parentOf, queried });
    } catch (e) {
      setError({ message: e.message, noRdap: e.noRdap, zone: e.zone });
    }
    setBusy(false);
  };

  const runLegacy = async () => {
    setLegacy({ loading: true });
    try { setLegacy(await legacyWhois(classifyQuery(input).value)); }
    catch (e) { setLegacy({ error: e instanceof ProxyUnavailableError ? e.message : `WHOIS failed: ${e.message}` }); }
  };

  return (
    <Stack gap="md">
      <Panel>
        <Group align="flex-end" wrap="wrap">
          <TextInput size="md" label="Domain, IP address or ASN" value={input} onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()} style={{ flex: 1, minWidth: 260 }} className="code-font"
            rightSection={detected && <Badge size="xs" variant="light">{TYPE_LABEL[detected.type]}</Badge>} rightSectionWidth={90} />
          <Button size="md" leftSection={<IconSearch size={16} />} onClick={() => run()} loading={busy}>Look up</Button>
        </Group>
        <Group gap={6} mt="sm">
          <Text size="xs" c="dimmed">Try:</Text>
          {EXAMPLES.map((x) => <Badge key={x} variant="light" tt="none" style={{ cursor: 'pointer' }} onClick={() => { setInput(x); run(x); }}>{x}</Badge>)}
        </Group>
      </Panel>

      {error && (
        <Alert color={error.noRdap ? 'orange' : 'red'} title={error.noRdap ? 'No RDAP for this TLD' : 'Lookup failed'}>
          <Text size="sm">{error.message}</Text>
          {error.noRdap && (
            <Stack gap="xs" mt="sm">
              <Group>
                <Button size="xs" variant="light" onClick={runLegacy} loading={legacy?.loading}>Try legacy WHOIS via DevForge proxy</Button>
                <Anchor size="xs" href={`https://www.iana.org/domains/root/db/${error.zone}.html`} target="_blank" rel="noopener noreferrer">IANA info for .{error.zone}</Anchor>
              </Group>
              {legacy?.error && <Text size="xs" c="red">{legacy.error}</Text>}
            </Stack>
          )}
        </Alert>
      )}

      {legacy?.raw && (
        <Panel title={`WHOIS — ${legacy.server}`} actions={<CopyButton value={legacy.raw} icon />}>
          <Code block style={{ maxHeight: 500, overflow: 'auto' }}>{legacy.raw}</Code>
        </Panel>
      )}

      {busy && <Group gap="xs"><Loader size="xs" /><Text size="sm" c="dimmed">Querying the registry…</Text></Group>}

      {result && (
        <>
          {result.parentOf && (
            <Alert color="blue" p="xs">
              <Text size="sm">“{result.parentOf}” is a subdomain — subdomains have no registration of their own, so this shows the registered domain <b>{result.queried}</b>.</Text>
            </Alert>
          )}
          {result.q.type === 'domain' ? <DomainView s={result.s} related={result.related} /> : <NetworkView s={result.s} type={result.q.type} />}
          <Panel title="Raw RDAP response" icon={IconCode} actions={<>
            <Button size="compact-xs" variant="subtle" onClick={() => setShowRaw((v) => !v)}>{showRaw ? 'Hide' : 'Show'}</Button>
            <CopyButton value={JSON.stringify(result.data, null, 2)} icon />
          </>}>
            <Text size="xs" c="dimmed">Source: <Anchor size="xs" href={result.url} target="_blank" rel="noopener noreferrer">{result.url}</Anchor></Text>
            <Collapse in={showRaw}>
              <Code block mt="xs" style={{ maxHeight: 480, overflow: 'auto' }}>{JSON.stringify(result.data, null, 2)}</Code>
            </Collapse>
          </Panel>
        </>
      )}

      <Text size="xs" c="dimmed">
        Uses RDAP — the official JSON replacement for WHOIS. Your query goes straight from this browser to the registry (Verisign, ARIN, RIPE…) found via IANA&apos;s bootstrap files; DevForge servers never see it.
      </Text>
    </Stack>
  );
}
