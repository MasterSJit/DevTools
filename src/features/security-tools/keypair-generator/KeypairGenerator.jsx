import { useState } from 'react';
import { Stack, Group, Button, Select, Text, Tabs, Alert, SimpleGrid, Badge } from '@mantine/core';
import { IconKey, IconShieldCheck } from '@tabler/icons-react';
import { Panel, OutputArea, PrivacyNote } from '@/shared/components/ui';
import { toPem } from '@/shared/lib/crypto';
import { base64ToBytes, bytesToBase64, utf8Encode, concatBytes } from '@/shared/lib/encoding';

const KEY_TYPES = {
  'RSA-2048': { alg: { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, jwtAlg: 'RS256' },
  'RSA-3072': { alg: { name: 'RSASSA-PKCS1-v1_5', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, jwtAlg: 'RS256' },
  'RSA-4096': { alg: { name: 'RSASSA-PKCS1-v1_5', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, jwtAlg: 'RS256' },
  'ECDSA P-256': { alg: { name: 'ECDSA', namedCurve: 'P-256' }, jwtAlg: 'ES256', ssh: 'nistp256' },
  'ECDSA P-384': { alg: { name: 'ECDSA', namedCurve: 'P-384' }, jwtAlg: 'ES384', ssh: 'nistp384' },
  'ECDSA P-521': { alg: { name: 'ECDSA', namedCurve: 'P-521' }, jwtAlg: 'ES512', ssh: 'nistp521' },
  Ed25519: { alg: { name: 'Ed25519' }, jwtAlg: 'EdDSA' },
};

// ── OpenSSH public key wire format ──
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const sshString = (bytes) => concatBytes(u32(bytes.length), bytes);
const sshMpint = (bytes) => {
  let b = bytes;
  while (b.length > 1 && b[0] === 0) b = b.subarray(1);
  if (b[0] & 0x80) b = concatBytes(new Uint8Array([0]), b);
  return sshString(b);
};

async function sshPublicKey(type, keyPair, jwk) {
  let blob, name;
  if (type.startsWith('RSA')) {
    name = 'ssh-rsa';
    blob = concatBytes(sshString(utf8Encode(name)), sshMpint(base64ToBytes(jwk.e)), sshMpint(base64ToBytes(jwk.n)));
  } else if (type === 'Ed25519') {
    name = 'ssh-ed25519';
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
    blob = concatBytes(sshString(utf8Encode(name)), sshString(raw));
  } else {
    const curve = KEY_TYPES[type].ssh;
    name = `ecdsa-sha2-${curve}`;
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
    blob = concatBytes(sshString(utf8Encode(name)), sshString(utf8Encode(curve)), sshString(raw));
  }
  const fp = bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', blob))).replace(/=+$/, '');
  return { line: `${name} ${bytesToBase64(blob)} devforge-generated`, fingerprint: `SHA256:${fp}` };
}

export default function KeypairGenerator() {
  const [type, setType] = useState('ECDSA P-256');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('pem');

  const generate = async () => {
    setBusy(true); setError(null);
    try {
      const t = performance.now();
      const kp = await crypto.subtle.generateKey(KEY_TYPES[type].alg, true, ['sign', 'verify']);
      const [spki, pkcs8, pubJwk, privJwk] = await Promise.all([
        crypto.subtle.exportKey('spki', kp.publicKey),
        crypto.subtle.exportKey('pkcs8', kp.privateKey),
        crypto.subtle.exportKey('jwk', kp.publicKey),
        crypto.subtle.exportKey('jwk', kp.privateKey),
      ]);
      const alg = KEY_TYPES[type].jwtAlg;
      const kid = bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', spki))).slice(0, 16).replace(/[+/=]/g, '');
      const ssh = await sshPublicKey(type, kp, pubJwk);
      const clean = (j) => { const { key_ops, ext, ...rest } = j; return { ...rest, alg, kid, use: 'sig' }; };
      setResult({
        publicPem: toPem(spki, 'PUBLIC KEY'),
        privatePem: toPem(pkcs8, 'PRIVATE KEY'),
        publicJwk: JSON.stringify(clean(pubJwk), null, 2),
        privateJwk: JSON.stringify(clean(privJwk), null, 2),
        jwks: JSON.stringify({ keys: [clean(pubJwk)] }, null, 2),
        ssh,
        ms: Math.round(performance.now() - t),
        alg,
      });
    } catch (e) {
      setError(type === 'Ed25519' ? `Ed25519 is not supported by this browser's Web Crypto yet (${e.message}). Try a recent Chrome, Firefox or Safari.` : e.message);
      setResult(null);
    }
    setBusy(false);
  };

  return (
    <Stack gap="md">
      <Panel>
        <Group align="flex-end">
          <Select label="Key type" value={type} onChange={(v) => { setType(v); setResult(null); }} data={Object.keys(KEY_TYPES)} allowDeselect={false} w={200} />
          <Button leftSection={<IconKey size={16} />} onClick={generate} loading={busy}>Generate key pair</Button>
          {result && <Badge variant="light">{result.ms} ms · JWT alg {result.alg}</Badge>}
        </Group>
        <Text size="xs" c="dimmed" mt="sm">
          Recommended: ECDSA P-256 or Ed25519 for new systems; RSA 3072+ when RSA is required. Keys are generated with Web Crypto and never leave your browser.
        </Text>
      </Panel>

      {error && <Alert color="red">{error}</Alert>}

      {result && (
        <>
          <Tabs value={tab} onChange={setTab}>
            <Tabs.List>
              <Tabs.Tab value="pem">PEM</Tabs.Tab>
              <Tabs.Tab value="jwk">JWK / JWKS</Tabs.Tab>
              <Tabs.Tab value="ssh">OpenSSH</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          {tab === 'pem' && (
            <SimpleGrid cols={{ base: 1, lg: 2 }}>
              <OutputArea label="Public key (SPKI)" value={result.publicPem} filename="public.pem" minRows={6} />
              <OutputArea label="Private key (PKCS#8) — keep secret!" value={result.privatePem} filename="private.pem" minRows={6} />
            </SimpleGrid>
          )}
          {tab === 'jwk' && (
            <SimpleGrid cols={{ base: 1, lg: 3 }}>
              <OutputArea label="Public JWK" value={result.publicJwk} filename="public.jwk.json" minRows={8} />
              <OutputArea label="Private JWK — keep secret!" value={result.privateJwk} filename="private.jwk.json" minRows={8} />
              <OutputArea label="JWKS (publish at /.well-known/jwks.json)" value={result.jwks} filename="jwks.json" minRows={8} />
            </SimpleGrid>
          )}
          {tab === 'ssh' && (
            <Stack gap="sm">
              <OutputArea label="authorized_keys line" value={result.ssh.line} filename="id_key.pub" minRows={2} />
              <Panel title="Fingerprint" icon={IconShieldCheck}>
                <Text ff="monospace" size="sm">{result.ssh.fingerprint}</Text>
                <Text size="xs" c="dimmed" mt={4}>Matches the output of <code>ssh-keygen -lf id_key.pub</code>. The PKCS#8 private key from the PEM tab can be used with OpenSSH (chmod 600).</Text>
              </Panel>
            </Stack>
          )}
        </>
      )}
      <PrivacyNote />
    </Stack>
  );
}
