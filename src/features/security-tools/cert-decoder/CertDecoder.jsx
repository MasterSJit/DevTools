import { useEffect, useMemo, useState } from 'react';
import {
  Stack, Group, Text, Textarea, Badge, Alert, SimpleGrid, Table, Code, Progress, Tabs, TextInput, Button, ScrollArea, Anchor,
} from '@mantine/core';
import { IconCertificate, IconShieldCheck, IconList, IconSearch, IconWorldSearch } from '@tabler/icons-react';
import { ctSearch } from '@/shared/lib/ct';
import FixGuides from '@/shared/components/FixGuides';
import FileDropZone from '@/shared/components/FileDropZone';
import { Panel, KVTable, FindingList, PrivacyNote } from '@/shared/components/ui';
import { decodeCertificate, decodeCsr } from '@/shared/lib/asn1';
import { parsePemBlocks } from '@/shared/lib/crypto';
import { base64ToBytes, bytesToHex, bytesToBase64 } from '@/shared/lib/encoding';

const DAY = 86400000;

function certFindings(c) {
  const f = [];
  const now = Date.now();
  if (c.type === 'certificate') {
    if (c.notAfter < now) f.push({ level: 'critical', title: 'Certificate has expired', detail: `Expired on ${c.notAfter.toUTCString()}.`, fix: 'cert-renew' });
    else if (c.notAfter - now < 30 * DAY) f.push({ level: 'medium', title: 'Expires within 30 days', detail: `Expires ${c.notAfter.toUTCString()}.`, fix: 'cert-renew' });
    if (c.notBefore > now) f.push({ level: 'high', title: 'Not valid yet', detail: `Valid from ${c.notBefore.toUTCString()}.` });
    const lifetime = (c.notAfter - c.notBefore) / DAY;
    if (!c.isCa && lifetime > 398) f.push({ level: 'low', title: `Long validity (${Math.round(lifetime)} days)`, detail: 'Publicly trusted TLS certificates are limited to 398 days.' });
    if (c.subject.text === c.issuer.text) f.push({ level: c.isCa ? 'info' : 'medium', title: 'Self-signed', detail: c.isCa ? 'Root CA certificate.' : 'Browsers will not trust this certificate unless it is installed manually.' });
  }
  if (/md5|sha1/i.test(c.signatureAlgorithm)) f.push({ level: 'high', title: `Weak signature algorithm (${c.signatureAlgorithm})`, detail: 'MD5/SHA-1 signatures are deprecated and collision-prone.' });
  if (c.publicKey.algorithm === 'RSA' && c.publicKey.bits < 2048) f.push({ level: 'high', title: `Weak RSA key (${c.publicKey.bits} bits)`, detail: 'Use at least 2048-bit RSA (3072+ recommended).' });
  if (!c.isCa && c.san.length === 0) f.push({ level: 'medium', title: 'No Subject Alternative Names', detail: 'Modern browsers ignore the CN and require SANs for hostnames.' });
  if (c.san.some((s) => s.type === 'DNS' && s.value.startsWith('*.'))) f.push({ level: 'info', title: 'Wildcard certificate', detail: 'A compromise of this key affects every matching subdomain.' });
  if (!f.some((x) => ['critical', 'high', 'medium'].includes(x.level))) f.push({ level: 'pass', title: 'No problems detected' });
  return f;
}

function CertView({ cert, index, total }) {
  const now = Date.now();
  const lifetime = cert.type === 'certificate' ? cert.notAfter - cert.notBefore : 0;
  const elapsed = cert.type === 'certificate' ? Math.min(100, Math.max(0, ((now - cert.notBefore) / lifetime) * 100)) : 0;
  const daysLeft = cert.type === 'certificate' ? Math.floor((cert.notAfter - now) / DAY) : 0;
  const pk = cert.publicKey;

  return (
    <Stack gap="md">
      <Panel
        title={`${total > 1 ? `#${index + 1} · ` : ''}${cert.subject.get('CN') || cert.subject.text || 'Certificate'}`}
        icon={IconCertificate}
        actions={<>
          <Badge variant="light">{cert.type === 'csr' ? 'CSR' : cert.isCa ? 'CA certificate' : 'End-entity'}</Badge>
          {cert.type === 'certificate' && <Badge color={daysLeft < 0 ? 'red' : daysLeft < 30 ? 'orange' : 'teal'}>{daysLeft < 0 ? 'Expired' : `${daysLeft} days left`}</Badge>}
        </>}
      >
        {cert.type === 'certificate' && (
          <div className="mb-3">
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed">{cert.notBefore.toUTCString()}</Text>
              <Text size="xs" c="dimmed">{cert.notAfter.toUTCString()}</Text>
            </Group>
            <Progress value={elapsed} color={daysLeft < 0 ? 'red' : daysLeft < 30 ? 'orange' : 'teal'} size="sm" />
          </div>
        )}
        <KVTable rows={[
          ['Subject', cert.subject.text],
          cert.type === 'certificate' && ['Issuer', cert.issuer.text],
          cert.type === 'certificate' && ['Serial number', cert.serial],
          cert.type === 'certificate' && ['Version', `v${cert.version}`],
          ['Signature algorithm', cert.signatureAlgorithm],
          ['Public key', `${pk.algorithm}${pk.curve ? ` ${pk.curve}` : ''}${pk.bits ? ` (${pk.bits} bits)` : ''}${pk.exponent ? `, e=${pk.exponent}` : ''}`],
          ['SHA-256 fingerprint', cert.sha256],
          ['SHA-1 fingerprint', cert.sha1],
        ]} />
      </Panel>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title={`Subject Alternative Names (${cert.san.length})`} icon={IconList}>
          {cert.san.length ? (
            <Group gap={6}>{cert.san.map((s, i) => <Badge key={i} variant="outline" color={s.type === 'DNS' ? 'indigo' : 'gray'} tt="none">{s.type}: {s.value}</Badge>)}</Group>
          ) : <Text size="sm" c="dimmed">None</Text>}
        </Panel>
        <Panel title="Security review" icon={IconShieldCheck}>
          <FindingList findings={certFindings(cert)} />
        </Panel>
      </SimpleGrid>
      <FixGuides findings={certFindings(cert)} />

      {cert.extensions.length > 0 && (
        <Panel title={`Extensions (${cert.extensions.length})`}>
          <Table verticalSpacing={6} striped>
            <Table.Tbody>
              {cert.extensions.map((e, i) => (
                <Table.Tr key={i}>
                  <Table.Td w={240} style={{ verticalAlign: 'top' }}>
                    <Text size="xs" fw={600}>{e.name}</Text>
                    {e.critical && <Badge size="xs" color="orange" variant="light">critical</Badge>}
                  </Table.Td>
                  <Table.Td><Text size="xs" ff="monospace" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{e.text}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Panel>
      )}
    </Stack>
  );
}

async function decodeDer(der, isCsr = false) {
  const decoded = isCsr ? decodeCsr(der) : decodeCertificate(der);
  const [s256, s1] = await Promise.all([crypto.subtle.digest('SHA-256', der), crypto.subtle.digest('SHA-1', der)]);
  decoded.sha256 = bytesToHex(new Uint8Array(s256), ':').toUpperCase();
  decoded.sha1 = bytesToHex(new Uint8Array(s1), ':').toUpperCase();
  return decoded;
}

function DomainLookup() {
  const [domain, setDomain] = useState('dev-tools.serversbay.com');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const run = async () => {
    setBusy(true); setError(null); setResult(null); setSelected(null);
    try {
      const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:].*$/, '');
      // Cert Spotter returns the full DER so certificates can be decoded; crt.sh is the fallback.
      const { certs, source, errors } = await ctSearch(d, { source: 'certspotter', subdomains: false, includeExpired: true, withDer: true })
        .catch(() => ctSearch(d, { source: 'crt.sh', subdomains: false, includeExpired: true }));
      const sorted = [...certs].sort((a, b) => b.notBefore - a.notBefore);
      setResult({ domain: d, certs: sorted, source, errors });
      const first = sorted.find((c) => c.der && c.notAfter > Date.now());
      if (first) setSelected({ id: first.id, cert: await decodeDer(base64ToBytes(first.der)) });
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const open = async (c) => {
    try { setSelected({ id: c.id, cert: await decodeDer(base64ToBytes(c.der)) }); }
    catch (e) { setError(`Could not decode certificate: ${e.message}`); }
  };

  const now = Date.now();
  const valid = result?.certs.filter((c) => c.notAfter > now && c.notBefore < now && !c.revoked) || [];
  const latest = valid[0];
  const daysLeft = latest ? Math.floor((latest.notAfter - now) / DAY) : null;

  return (
    <Stack gap="md">
      <Panel>
        <Group align="flex-end">
          <TextInput size="md" label="Hostname" value={domain} onChange={(e) => setDomain(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && run()}
            style={{ flex: 1 }} className="code-font" placeholder="www.example.com" />
          <Button size="md" leftSection={<IconSearch size={16} />} onClick={run} loading={busy}>Find certificates</Button>
        </Group>
        <Text size="xs" c="dimmed" mt="sm">
          Searches Certificate Transparency logs for every publicly trusted certificate covering this hostname (wildcards included).
          This shows what has been <i>issued</i> — the certificate a server presents right now is normally the newest valid one.
        </Text>
      </Panel>
      {error && <Alert color="red">{error}</Alert>}
      {result && (
        <>
          <Alert color={!latest ? 'red' : daysLeft < 15 ? 'orange' : 'teal'} title={latest ? `Newest valid certificate expires in ${daysLeft} days` : 'No currently valid certificate found in CT logs'}>
            <Text size="sm">
              {result.certs.length} certificate{result.certs.length === 1 ? '' : 's'} found via {result.source} · {valid.length} currently valid
              {latest ? ` · issued by ${latest.issuer} on ${latest.notBefore.toISOString().slice(0, 10)}` : ''}
            </Text>
          </Alert>
          <Panel title="Certificates (newest first)" icon={IconList}>
            <ScrollArea.Autosize mah={340}>
              <Table striped verticalSpacing={4} highlightOnHover>
                <Table.Thead><Table.Tr><Table.Th>Issued</Table.Th><Table.Th>Expires</Table.Th><Table.Th>Issuer</Table.Th><Table.Th>Names</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {result.certs.slice(0, 100).map((c) => {
                    const expired = c.notAfter < now;
                    return (
                      <Table.Tr key={c.id} style={selected?.id === c.id ? { background: 'var(--mantine-color-indigo-light)' } : undefined}>
                        <Table.Td><Text size="xs">{c.notBefore.toISOString().slice(0, 10)}</Text></Table.Td>
                        <Table.Td><Text size="xs" c={expired ? 'red' : undefined}>{c.notAfter.toISOString().slice(0, 10)}{expired ? ' (expired)' : ''}{c.revoked ? ' (revoked)' : ''}</Text></Table.Td>
                        <Table.Td><Text size="xs">{c.issuer}</Text></Table.Td>
                        <Table.Td><Text size="xs" ff="monospace" lineClamp={2}>{c.names.join(', ')}</Text></Table.Td>
                        <Table.Td w={90}>
                          {c.der
                            ? <Button size="compact-xs" variant="light" onClick={() => open(c)}>Decode</Button>
                            : <Anchor size="xs" href={c.link} target="_blank" rel="noopener noreferrer">crt.sh</Anchor>}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          </Panel>
          {selected && <CertView cert={selected.cert} index={0} total={1} />}
        </>
      )}
    </Stack>
  );
}

function PasteDecoder() {
  const [input, setInput] = useState('');
  const [certs, setCerts] = useState([]);
  const [error, setError] = useState(null);

  const blocks = useMemo(() => parsePemBlocks(input), [input]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      if (!input.trim()) { setCerts([]); return; }
      try {
        // Accept PEM blocks, or a bare Base64 DER blob.
        const items = blocks.length ? blocks : [{ label: 'CERTIFICATE', b64: input.replace(/\s/g, '') }];
        const out = [];
        for (const b of items) {
          if (!/CERTIFICATE/.test(b.label)) continue;
          out.push(await decodeDer(base64ToBytes(b.b64), /REQUEST/.test(b.label)));
        }
        if (!out.length) throw new Error(`No certificate found. Found PEM block(s): ${blocks.map((b) => b.label).join(', ') || 'none'}.`);
        if (!cancelled) setCerts(out);
      } catch (e) {
        if (!cancelled) { setCerts([]); setError(e.message); }
      }
    })();
    return () => { cancelled = true; };
  }, [input, blocks]);

  const onFile = async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Binary DER (.cer/.der) starts with a SEQUENCE tag; otherwise treat as PEM text.
    if (bytes[0] === 0x30) setInput(`-----BEGIN CERTIFICATE-----\n${bytesToBase64(bytes)}\n-----END CERTIFICATE-----`);
    else setInput(new TextDecoder().decode(bytes));
  };

  return (
    <Stack gap="md">
      <Panel title="Certificate or CSR (PEM)" actions={<FileDropZone compact onFile={onFile} />}>
        <Textarea value={input} onChange={(e) => setInput(e.currentTarget.value)} autosize minRows={6} maxRows={14}
          className="code-font" spellCheck={false}
          placeholder={'-----BEGIN CERTIFICATE-----\nMIID…\n-----END CERTIFICATE-----\n\nPaste one cert, a full chain, or a CSR. Tip: openssl s_client -connect example.com:443 -showcerts'} />
      </Panel>
      {error && <Alert color="red">{error}</Alert>}
      {certs.length > 1 && <Text size="sm" c="dimmed">Chain with {certs.length} certificates.</Text>}
      {certs.map((c, i) => <CertView key={i} cert={c} index={i} total={certs.length} />)}
      {!input && (
        <Text size="xs" c="dimmed">
          Get a site&apos;s certificate in the browser: click the padlock → Connection is secure → Certificate → Export, then drop the file here.
          Or run <Code>openssl s_client -connect host:443 -showcerts &lt;/dev/null</Code> — or use the “Look up by domain” tab.
        </Text>
      )}
      <PrivacyNote />
    </Stack>
  );
}

export default function CertDecoder() {
  const [tab, setTab] = useState('paste');
  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="paste" leftSection={<IconCertificate size={14} />}>Paste / upload PEM</Tabs.Tab>
          <Tabs.Tab value="domain" leftSection={<IconWorldSearch size={14} />}>Look up by domain (CT logs)</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'paste' ? <PasteDecoder /> : <DomainLookup />}
    </Stack>
  );
}
