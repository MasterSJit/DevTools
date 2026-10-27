import { useEffect, useMemo, useState } from 'react';
import {
  Stack, Group, Button, Text, TextInput, Select, SimpleGrid, RingProgress, Badge, Alert, Paper, NumberInput,
} from '@mantine/core';
import { IconRefresh, IconDeviceMobileCode } from '@tabler/icons-react';
import QRCode from 'qrcode';
import CopyButton from '@/shared/components/CopyButton';
import { Panel, PrivacyNote } from '@/shared/components/ui';
import { base32Decode, base32Encode } from '@/shared/lib/encoding';
import { randomBytes } from '@/shared/lib/crypto';

const HASHES = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' };

// RFC 4226 HOTP / RFC 6238 TOTP
async function hotp(secretBytes, counter, algo, digits) {
  const msg = new Uint8Array(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) { msg[i] = Number(c & 0xffn); c >>= 8n; }
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: HASHES[algo] }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const off = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export default function TotpGenerator() {
  const [secret, setSecret] = useState(() => base32Encode(randomBytes(20), false));
  const [algo, setAlgo] = useState('SHA1');
  const [digits, setDigits] = useState(6);
  const [period, setPeriod] = useState(30);
  const [issuer, setIssuer] = useState('DevForge');
  const [account, setAccount] = useState('user@example.com');
  const [now, setNow] = useState(Date.now());
  const [codes, setCodes] = useState(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const step = Math.floor(now / 1000 / period);
  const remaining = period - (Math.floor(now / 1000) % period);

  const secretBytes = useMemo(() => {
    try { const b = base32Decode(secret); return b.length ? b : null; } catch { return null; }
  }, [secret]);

  useEffect(() => {
    if (!secretBytes) { setCodes(null); setError(secret ? 'Secret must be valid Base32 (A–Z, 2–7).' : null); return; }
    setError(null);
    let cancelled = false;
    Promise.all([step - 1, step, step + 1].map((s) => hotp(secretBytes, s, algo, digits)))
      .then(([prev, cur, next]) => !cancelled && setCodes({ prev, cur, next }));
    return () => { cancelled = true; };
  }, [secretBytes, step, algo, digits, secret]);

  const uri = useMemo(() => {
    const label = encodeURIComponent(issuer ? `${issuer}:${account}` : account);
    const params = new URLSearchParams({ secret: secret.replace(/\s|=/g, ''), issuer, algorithm: algo, digits: String(digits), period: String(period) });
    return `otpauth://totp/${label}?${params}`;
  }, [secret, issuer, account, algo, digits, period]);

  useEffect(() => {
    QRCode.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(''));
  }, [uri]);

  const fmt = (c) => (c && c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Panel title="Secret & settings" icon={IconDeviceMobileCode}>
          <Stack gap="sm">
            <Group align="flex-end" wrap="nowrap">
              <TextInput label="Base32 secret" value={secret} onChange={(e) => setSecret(e.currentTarget.value.toUpperCase())} style={{ flex: 1 }} className="code-font" />
              <Button variant="light" leftSection={<IconRefresh size={14} />} onClick={() => setSecret(base32Encode(randomBytes(20), false))}>New</Button>
            </Group>
            <Group grow>
              <Select label="Algorithm" value={algo} onChange={setAlgo} data={Object.keys(HASHES)} allowDeselect={false} />
              <Select label="Digits" value={String(digits)} onChange={(v) => setDigits(Number(v))} data={['6', '7', '8']} allowDeselect={false} />
              <NumberInput label="Period (s)" value={period} onChange={(v) => setPeriod(Math.max(5, Number(v) || 30))} min={5} max={300} />
            </Group>
            <Group grow>
              <TextInput label="Issuer" value={issuer} onChange={(e) => setIssuer(e.currentTarget.value)} />
              <TextInput label="Account" value={account} onChange={(e) => setAccount(e.currentTarget.value)} />
            </Group>
            {error && <Alert color="red" p="xs">{error}</Alert>}
          </Stack>
        </Panel>

        <Panel title="Current code">
          <Group align="center" justify="center" gap="xl" py="md">
            <RingProgress size={110} thickness={8} roundCaps
              sections={[{ value: (remaining / period) * 100, color: remaining <= 5 ? 'red' : 'indigo' }]}
              label={<Text ta="center" fw={700}>{remaining}s</Text>} />
            <div>
              <Group gap="xs">
                <Text ff="monospace" fw={700} style={{ fontSize: 40, letterSpacing: 2 }}>{codes ? fmt(codes.cur) : '———'}</Text>
                {codes && <CopyButton value={codes.cur} icon />}
              </Group>
              {codes && (
                <Group gap="xs" mt={4}>
                  <Badge variant="light" color="gray">prev {codes.prev}</Badge>
                  <Badge variant="light" color="gray">next {codes.next}</Badge>
                </Group>
              )}
            </div>
          </Group>
          <Text size="xs" c="dimmed" ta="center">Counter T = {step} · Unix time {Math.floor(now / 1000)}</Text>
        </Panel>
      </SimpleGrid>

      <Panel title="Provisioning (scan with an authenticator app)">
        <Group align="flex-start" wrap="wrap">
          {qr && <Paper p={6} bg="white"><img src={qr} alt="otpauth QR code" width={180} height={180} /></Paper>}
          <Stack gap={6} style={{ flex: 1, minWidth: 260 }}>
            <Group wrap="nowrap" gap="xs">
              <Text size="xs" ff="monospace" style={{ wordBreak: 'break-all', flex: 1 }}>{uri}</Text>
              <CopyButton value={uri} icon />
            </Group>
            <Text size="xs" c="dimmed">
              Most authenticator apps (Google Authenticator, Authy) only support SHA1 with 6 digits and 30 s. Store secrets server-side encrypted,
              and accept ±1 time step to tolerate clock drift.
            </Text>
          </Stack>
        </Group>
      </Panel>
      <PrivacyNote>Codes are computed locally with HMAC via Web Crypto. Do not paste production secrets into shared machines.</PrivacyNote>
    </Stack>
  );
}
