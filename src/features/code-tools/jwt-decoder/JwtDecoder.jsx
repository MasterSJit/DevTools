import { useState, useMemo, useEffect } from 'react';
import {
  Stack, Group, Text, Textarea, Badge, Tabs, Select, Button, Switch, SimpleGrid, Alert, Code, Table, Tooltip,
} from '@mantine/core';
import { IconKey, IconShieldCheck, IconSignature, IconClock } from '@tabler/icons-react';
import * as jose from 'jose';
import CopyButton from '@/shared/components/CopyButton';
import { Panel, FindingList, PrivacyNote } from '@/shared/components/ui';
import { base64ToBytes, utf8Decode, utf8Encode } from '@/shared/lib/encoding';

const SAMPLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const ALGS = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512', 'EdDSA'];
const TIME_CLAIMS = { exp: 'Expires', iat: 'Issued at', nbf: 'Not before', auth_time: 'Auth time' };
const CLAIM_NAMES = { iss: 'Issuer', sub: 'Subject', aud: 'Audience', jti: 'JWT ID', scope: 'Scope', azp: 'Authorized party', nonce: 'Nonce' };

function decodePart(part) {
  return JSON.parse(utf8Decode(base64ToBytes(part)));
}

function decodeJwt(token) {
  const parts = token.trim().split('.');
  if (parts.length === 5) throw new Error('This is an encrypted JWE (5 parts) — it cannot be decoded without the key.');
  if (parts.length !== 3) throw new Error(`Invalid JWT: expected 3 dot-separated parts, got ${parts.length}.`);
  let header, payload;
  try { header = decodePart(parts[0]); } catch { throw new Error('Header is not valid Base64URL-encoded JSON.'); }
  try { payload = decodePart(parts[1]); } catch { throw new Error('Payload is not valid Base64URL-encoded JSON.'); }
  return { header, payload, signature: parts[2] };
}

function relative(sec) {
  const diff = sec * 1000 - Date.now();
  const abs = Math.abs(diff);
  const units = [[86400000, 'day'], [3600000, 'hour'], [60000, 'minute'], [1000, 'second']];
  for (const [ms, name] of units) {
    if (abs >= ms) {
      const v = Math.round(abs / ms);
      return diff > 0 ? `in ${v} ${name}${v > 1 ? 's' : ''}` : `${v} ${name}${v > 1 ? 's' : ''} ago`;
    }
  }
  return 'now';
}

function securityFindings({ header, payload }) {
  const f = [];
  const now = Date.now() / 1000;
  const alg = String(header.alg || '');
  if (!alg || alg.toLowerCase() === 'none') f.push({ level: 'critical', title: 'alg is "none"', detail: 'Unsigned token. Servers must reject alg=none — otherwise anyone can forge tokens.' });
  if (alg.startsWith('HS')) f.push({ level: 'info', title: `Symmetric algorithm (${alg})`, detail: 'Anyone who can verify can also sign. Use a random secret of at least 256 bits; prefer RS/ES/EdDSA when third parties verify.' });
  if (header.jku || header.x5u) f.push({ level: 'high', title: `Header contains ${header.jku ? 'jku' : 'x5u'} URL`, detail: 'Verifiers must never fetch keys from a URL supplied inside the token without a strict allow-list.' });
  if (header.jwk) f.push({ level: 'high', title: 'Embedded jwk in header', detail: 'Never trust a public key that ships inside the token itself.' });
  if (header.kid && /[./\\'";]|\.\./.test(String(header.kid))) f.push({ level: 'medium', title: 'Suspicious characters in kid', detail: 'kid values with path or quote characters can indicate injection attempts against key lookups.' });
  if (payload.exp == null) f.push({ level: 'medium', title: 'No expiry (exp)', detail: 'Tokens without exp stay valid forever if leaked.' });
  else if (payload.exp < now) f.push({ level: 'low', title: 'Token has expired', detail: `Expired ${relative(payload.exp)}.` });
  else if (payload.exp - (payload.iat || now) > 60 * 60 * 24 * 30) f.push({ level: 'low', title: 'Very long lifetime', detail: 'Lifetime is over 30 days — consider short-lived access tokens plus refresh tokens.' });
  if (payload.nbf && payload.nbf > now) f.push({ level: 'info', title: 'Not valid yet (nbf in the future)' });
  if (payload.iat && payload.iat > now + 300) f.push({ level: 'medium', title: 'iat is in the future', detail: 'Clock skew or a forged token.' });
  const sensitive = Object.keys(payload).filter((k) => /pass(word)?|secret|ssn|credit|card|cvv|private/i.test(k));
  if (sensitive.length) f.push({ level: 'high', title: 'Sensitive-looking claims', detail: `JWT payloads are only Base64-encoded, not encrypted: ${sensitive.join(', ')}.` });
  if (!payload.aud) f.push({ level: 'info', title: 'No audience (aud)', detail: 'Without aud, a token issued for one service may be accepted by another.' });
  if (!f.some((x) => ['critical', 'high', 'medium'].includes(x.level))) f.push({ level: 'pass', title: 'No major red flags in header/claims' });
  return f;
}

async function importVerifyKey(alg, keyText, secretIsBase64) {
  if (alg.startsWith('HS')) return secretIsBase64 ? base64ToBytes(keyText) : utf8Encode(keyText);
  const t = keyText.trim();
  if (t.startsWith('{')) return jose.importJWK(JSON.parse(t), alg);
  if (t.includes('BEGIN CERTIFICATE')) return jose.importX509(t, alg);
  return jose.importSPKI(t, alg);
}

async function importSignKey(alg, keyText, secretIsBase64) {
  if (alg.startsWith('HS')) return secretIsBase64 ? base64ToBytes(keyText) : utf8Encode(keyText);
  const t = keyText.trim();
  if (t.startsWith('{')) return jose.importJWK(JSON.parse(t), alg);
  return jose.importPKCS8(t, alg);
}

function Decoder() {
  const [token, setToken] = useState(SAMPLE);
  const [key, setKey] = useState('your-256-bit-secret');
  const [b64Secret, setB64Secret] = useState(false);
  const [verify, setVerify] = useState(null);

  const decoded = useMemo(() => {
    if (!token.trim()) return null;
    try { return { ...decodeJwt(token) }; } catch (e) { return { error: e.message }; }
  }, [token]);

  const alg = decoded?.header?.alg || '';

  useEffect(() => {
    let cancelled = false;
    setVerify(null);
    if (!decoded || decoded.error || !key.trim() || !alg || alg === 'none') return;
    (async () => {
      try {
        const k = await importVerifyKey(alg, key, b64Secret);
        // Signature only — claim checks (exp/nbf) are reported separately in the security review.
        await jose.compactVerify(token.trim(), k, { algorithms: [alg] });
        if (!cancelled) setVerify({ ok: true });
      } catch (e) {
        if (!cancelled) setVerify({ ok: false, msg: e.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' ? 'Invalid signature' : e.message });
      }
    })();
    return () => { cancelled = true; };
  }, [decoded, key, b64Secret, alg, token]);

  return (
    <Stack gap="md">
      <Panel title="Encoded token" actions={<CopyButton value={token} icon />}>
        <Textarea value={token} onChange={(e) => setToken(e.currentTarget.value)} autosize minRows={3} maxRows={8}
          className="code-font" placeholder="Paste a JWT (eyJ…)" spellCheck={false} />
        {decoded && !decoded.error && (
          <Text size="xs" mt={6} ff="monospace" style={{ wordBreak: 'break-all' }}>
            {token.trim().split('.').map((p, i) => (
              <span key={i} style={{ color: ['var(--mantine-color-red-6)', 'var(--mantine-color-violet-5)', 'var(--mantine-color-cyan-6)'][i] }}>
                {p}{i < 2 ? '.' : ''}
              </span>
            ))}
          </Text>
        )}
      </Panel>

      {decoded?.error && <Alert color="red">{decoded.error}</Alert>}

      {decoded && !decoded.error && (
        <>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Panel title="Header" actions={<CopyButton value={JSON.stringify(decoded.header, null, 2)} icon />}>
              <Code block>{JSON.stringify(decoded.header, null, 2)}</Code>
            </Panel>
            <Panel title="Payload" actions={<CopyButton value={JSON.stringify(decoded.payload, null, 2)} icon />}>
              <Code block>{JSON.stringify(decoded.payload, null, 2)}</Code>
            </Panel>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Panel title="Claims" icon={IconClock}>
              <Table verticalSpacing={4} withRowBorders={false}>
                <Table.Tbody>
                  {Object.entries(decoded.payload).map(([k, v]) => (
                    <Table.Tr key={k}>
                      <Table.Td w={130}><Tooltip label={TIME_CLAIMS[k] || CLAIM_NAMES[k] || 'Custom claim'}><Code>{k}</Code></Tooltip></Table.Td>
                      <Table.Td style={{ wordBreak: 'break-all' }}>
                        <Text size="xs" ff="monospace">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</Text>
                        {TIME_CLAIMS[k] && typeof v === 'number' && (
                          <Text size="xs" c="dimmed">{new Date(v * 1000).toLocaleString()} · {relative(v)}</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Panel>
            <Panel title="Security review" icon={IconShieldCheck}>
              <FindingList findings={securityFindings(decoded)} />
            </Panel>
          </SimpleGrid>

          <Panel title={`Verify signature (${alg || 'unknown alg'})`} icon={IconSignature}>
            <Stack gap="xs">
              <Textarea value={key} onChange={(e) => setKey(e.currentTarget.value)} autosize minRows={alg.startsWith('HS') ? 1 : 4}
                className="code-font" spellCheck={false}
                placeholder={alg.startsWith('HS') ? 'Shared secret' : 'Public key: PEM (SPKI), X.509 certificate or JWK'} />
              <Group>
                {alg.startsWith('HS') && <Switch size="xs" label="Secret is Base64 encoded" checked={b64Secret} onChange={(e) => setB64Secret(e.currentTarget.checked)} />}
                {verify?.ok && <Badge color="teal" size="lg">✓ Signature verified</Badge>}
                {verify && !verify.ok && <Badge color="red" size="lg">✗ {verify.msg}</Badge>}
              </Group>
              <Text size="xs" c="dimmed">Expiry is ignored here so you can check signatures of old tokens; see the security review above for exp/nbf.</Text>
            </Stack>
          </Panel>
        </>
      )}
    </Stack>
  );
}

function Encoder() {
  const [alg, setAlg] = useState('HS256');
  const [header, setHeader] = useState('{\n  "typ": "JWT"\n}');
  const [payload, setPayload] = useState(() => JSON.stringify({ sub: '1234567890', name: 'Jane Doe', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }, null, 2));
  const [key, setKey] = useState('');
  const [b64Secret, setB64Secret] = useState(false);
  const [out, setOut] = useState('');
  const [error, setError] = useState(null);

  const sign = async () => {
    setError(null); setOut('');
    try {
      const h = { ...JSON.parse(header || '{}'), alg };
      const p = JSON.parse(payload || '{}');
      const k = await importSignKey(alg, key, b64Secret);
      setOut(await new jose.SignJWT(p).setProtectedHeader(h).sign(k));
    } catch (e) { setError(e.message); }
  };

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Panel title="Header (alg is set below)">
          <Textarea value={header} onChange={(e) => setHeader(e.currentTarget.value)} autosize minRows={4} className="code-font" />
        </Panel>
        <Panel title="Payload">
          <Textarea value={payload} onChange={(e) => setPayload(e.currentTarget.value)} autosize minRows={4} className="code-font" />
        </Panel>
      </SimpleGrid>
      <Panel title="Signing key">
        <Stack gap="xs">
          <Select w={160} value={alg} onChange={setAlg} data={ALGS} allowDeselect={false} label="Algorithm" />
          <Textarea value={key} onChange={(e) => setKey(e.currentTarget.value)} autosize minRows={alg.startsWith('HS') ? 1 : 5} className="code-font"
            placeholder={alg.startsWith('HS') ? 'Shared secret (use 32+ random bytes)' : 'Private key: PKCS#8 PEM (-----BEGIN PRIVATE KEY-----) or JWK'} />
          {alg.startsWith('HS') && <Switch size="xs" label="Secret is Base64 encoded" checked={b64Secret} onChange={(e) => setB64Secret(e.currentTarget.checked)} />}
          <Text size="xs" c="dimmed">Need a key pair? Use the Key Pair Generator tool and paste the private key here.</Text>
          <Group><Button onClick={sign} disabled={!key}>Sign token</Button></Group>
          {error && <Alert color="red" p="xs">{error}</Alert>}
        </Stack>
      </Panel>
      {out && (
        <Panel title="Signed JWT" actions={<CopyButton value={out} icon />}>
          <Text ff="monospace" size="sm" style={{ wordBreak: 'break-all' }}>{out}</Text>
        </Panel>
      )}
    </Stack>
  );
}

export default function JwtDecoder() {
  const [tab, setTab] = useState('decode');
  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="decode" leftSection={<IconKey size={14} />}>Decode &amp; verify</Tabs.Tab>
          <Tabs.Tab value="encode" leftSection={<IconSignature size={14} />}>Sign / encode</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'decode' ? <Decoder /> : <Encoder />}
      <PrivacyNote>Tokens and keys are processed locally with the jose library — never sent anywhere.</PrivacyNote>
    </Stack>
  );
}
