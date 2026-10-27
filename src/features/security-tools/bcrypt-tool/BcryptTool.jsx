import { useState } from 'react';
import {
  Stack, Group, Button, Text, Tabs, TextInput, PasswordInput, Slider, Badge, Select, NumberInput, SegmentedControl, Alert,
} from '@mantine/core';
import { IconSquareKey, IconCircleCheck, IconKey } from '@tabler/icons-react';
import bcrypt from 'bcryptjs';
import CopyButton from '@/shared/components/CopyButton';
import { Panel, KVTable, PrivacyNote } from '@/shared/components/ui';
import { pbkdf2, randomBytes } from '@/shared/lib/crypto';
import { bytesToHex, bytesToBase64, hexToBytes, utf8Encode } from '@/shared/lib/encoding';

function parseBcrypt(hash) {
  const m = hash.match(/^\$(2[abxy]?)\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/);
  return m ? { version: m[1], cost: parseInt(m[2], 10), salt: m[3], digest: m[4] } : null;
}

function BcryptPanel() {
  const [password, setPassword] = useState('');
  const [cost, setCost] = useState(12);
  const [hash, setHash] = useState('');
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(null);
  const [verifyHash, setVerifyHash] = useState('');
  const [verifyPw, setVerifyPw] = useState('');
  const [verdict, setVerdict] = useState(null);

  const generate = async () => {
    setBusy(true);
    const t = performance.now();
    const h = await bcrypt.hash(password, cost);
    setElapsed(Math.round(performance.now() - t));
    setHash(h);
    setBusy(false);
  };

  const verify = async () => {
    setVerdict(null);
    try { setVerdict(await bcrypt.compare(verifyPw, verifyHash.trim()) ? 'match' : 'nomatch'); }
    catch (e) { setVerdict(`error: ${e.message}`); }
  };

  const parsed = parseBcrypt(hash);
  const bytes = utf8Encode(password).length;

  return (
    <Stack gap="md">
      <Panel title="Generate bcrypt hash" icon={IconSquareKey}>
        <Stack gap="sm">
          <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} autoComplete="off" />
          {bytes > 72 && <Alert color="orange" p="xs">bcrypt only uses the first 72 bytes — this input is {bytes} bytes.</Alert>}
          <div>
            <Text size="sm" mb={4}>Cost factor: <b>{cost}</b> <Text span size="xs" c="dimmed">(2^{cost} = {(2 ** cost).toLocaleString()} rounds)</Text></Text>
            <Slider value={cost} onChange={setCost} min={4} max={15} marks={[{ value: 10, label: '10' }, { value: 12, label: '12' }, { value: 14, label: '14' }]} mb="md" />
          </div>
          <Group>
            <Button onClick={generate} loading={busy} disabled={!password}>Hash</Button>
            {elapsed != null && <Text size="xs" c="dimmed">took {elapsed} ms</Text>}
          </Group>
          {hash && (
            <>
              <Group wrap="nowrap" gap="xs">
                <Text ff="monospace" size="sm" style={{ wordBreak: 'break-all', flex: 1 }}>{hash}</Text>
                <CopyButton value={hash} icon />
              </Group>
              {parsed && (
                <KVTable rows={[['Version', `$${parsed.version}$`], ['Cost', String(parsed.cost)], ['Salt (22 chars)', parsed.salt], ['Digest (31 chars)', parsed.digest]]} />
              )}
            </>
          )}
        </Stack>
      </Panel>

      <Panel title="Verify password against a hash" icon={IconCircleCheck}>
        <Stack gap="sm">
          <TextInput label="bcrypt hash" placeholder="$2b$12$…" value={verifyHash} onChange={(e) => setVerifyHash(e.currentTarget.value)} className="code-font" />
          <PasswordInput label="Password" value={verifyPw} onChange={(e) => setVerifyPw(e.currentTarget.value)} autoComplete="off" />
          <Group>
            <Button variant="light" onClick={verify} disabled={!verifyHash || !verifyPw}>Verify</Button>
            {verdict === 'match' && <Badge color="teal" size="lg">✓ Password matches</Badge>}
            {verdict === 'nomatch' && <Badge color="red" size="lg">✗ Does not match</Badge>}
            {verdict?.startsWith('error') && <Badge color="orange" size="lg">{verdict}</Badge>}
          </Group>
        </Stack>
      </Panel>
    </Stack>
  );
}

function Pbkdf2Panel() {
  const [password, setPassword] = useState('');
  const [salt, setSalt] = useState(() => bytesToHex(randomBytes(16)));
  const [saltFmt, setSaltFmt] = useState('hex');
  const [iterations, setIterations] = useState(600000);
  const [hash, setHash] = useState('SHA-256');
  const [length, setLength] = useState(32);
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const derive = async () => {
    setBusy(true); setError(null);
    try {
      const saltBytes = saltFmt === 'hex' ? hexToBytes(salt) : utf8Encode(salt);
      const t = performance.now();
      const key = await pbkdf2(password, saltBytes, iterations, hash, length);
      setOut({ hex: bytesToHex(key), b64: bytesToBase64(key), ms: Math.round(performance.now() - t) });
    } catch (e) { setError(e.message); setOut(null); }
    setBusy(false);
  };

  return (
    <Panel title="PBKDF2 key derivation" icon={IconKey}>
      <Stack gap="sm">
        <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} autoComplete="off" />
        <Group align="flex-end" wrap="nowrap">
          <TextInput label="Salt" value={salt} onChange={(e) => setSalt(e.currentTarget.value)} style={{ flex: 1 }} className="code-font" />
          <SegmentedControl size="xs" value={saltFmt} onChange={setSaltFmt} data={['hex', 'text']} />
          <Button variant="subtle" size="xs" onClick={() => { setSaltFmt('hex'); setSalt(bytesToHex(randomBytes(16))); }}>Random</Button>
        </Group>
        <Group grow>
          <NumberInput label="Iterations" value={iterations} onChange={(v) => setIterations(Number(v) || 1)} min={1} max={10000000} thousandSeparator="," />
          <Select label="Hash" value={hash} onChange={setHash} allowDeselect={false} data={['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']} />
          <NumberInput label="Key length (bytes)" value={length} onChange={(v) => setLength(Number(v) || 32)} min={1} max={256} />
        </Group>
        <Text size="xs" c="dimmed">OWASP 2023 guidance: PBKDF2-HMAC-SHA256 with at least 600,000 iterations.</Text>
        <Group><Button onClick={derive} loading={busy}>Derive key</Button></Group>
        {error && <Alert color="red" p="xs">{error}</Alert>}
        {out && <KVTable rows={[['Hex', out.hex], ['Base64', out.b64], ['Time', `${out.ms} ms`, { copy: false }]]} labelWidth={90} />}
      </Stack>
    </Panel>
  );
}

export default function BcryptTool() {
  const [tab, setTab] = useState('bcrypt');
  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="bcrypt">bcrypt</Tabs.Tab>
          <Tabs.Tab value="pbkdf2">PBKDF2</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'bcrypt' ? <BcryptPanel /> : <Pbkdf2Panel />}
      <PrivacyNote />
    </Stack>
  );
}
