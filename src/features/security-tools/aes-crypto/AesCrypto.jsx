import { useState } from 'react';
import {
  Stack, Group, Button, Text, Tabs, Textarea, PasswordInput, TextInput, Select, SegmentedControl, Alert, Badge,
} from '@mantine/core';
import { IconLock, IconLockOpen, IconFile, IconSettings } from '@tabler/icons-react';
import FileDropZone from '@/shared/components/FileDropZone';
import { Panel, OutputArea, PrivacyNote } from '@/shared/components/ui';
import { pbkdf2, randomBytes } from '@/shared/lib/crypto';
import {
  bytesToBase64, base64ToBytes, bytesToHex, hexToBytes, utf8Encode, utf8Decode, concatBytes,
} from '@/shared/lib/encoding';
import { downloadBlob, formatBytes } from '@/shared/lib/download';

const ITERATIONS = 600000;
const SALT_LEN = 16;
const IV_LEN = 12;

async function deriveKey(password, salt) {
  const raw = await pbkdf2(password, salt, ITERATIONS, 'SHA-256', 32);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// Layout: salt(16) | iv(12) | ciphertext + GCM tag(16)
async function encryptWithPassword(password, data) {
  const salt = randomBytes(SALT_LEN), iv = randomBytes(IV_LEN);
  const key = await deriveKey(password, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  return concatBytes(salt, iv, ct);
}

async function decryptWithPassword(password, blob) {
  if (blob.length < SALT_LEN + IV_LEN + 16) throw new Error('Ciphertext is too short.');
  const salt = blob.subarray(0, SALT_LEN), iv = blob.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const key = await deriveKey(password, salt);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, blob.subarray(SALT_LEN + IV_LEN)));
  } catch {
    throw new Error('Decryption failed — wrong password or the data was modified.');
  }
}

function PasswordMode() {
  const [mode, setMode] = useState('encrypt');
  const [input, setInput] = useState('');
  const [password, setPassword] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true); setError(null); setOutput('');
    try {
      if (mode === 'encrypt') setOutput(bytesToBase64(await encryptWithPassword(password, utf8Encode(input))));
      else setOutput(utf8Decode(await decryptWithPassword(password, base64ToBytes(input.trim()))));
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <Stack gap="md">
      <SegmentedControl value={mode} onChange={(v) => { setMode(v); setOutput(''); setError(null); }}
        data={[{ value: 'encrypt', label: 'Encrypt' }, { value: 'decrypt', label: 'Decrypt' }]} w={260} />
      <Textarea label={mode === 'encrypt' ? 'Plaintext' : 'Ciphertext (Base64)'} value={input} onChange={(e) => setInput(e.currentTarget.value)}
        autosize minRows={5} maxRows={14} className="code-font" spellCheck={false} />
      <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} autoComplete="new-password" />
      <Group>
        <Button onClick={run} loading={busy} disabled={!input || !password}
          leftSection={mode === 'encrypt' ? <IconLock size={16} /> : <IconLockOpen size={16} />}>
          {mode === 'encrypt' ? 'Encrypt' : 'Decrypt'}
        </Button>
        <Text size="xs" c="dimmed">AES-256-GCM · PBKDF2-SHA256 × {ITERATIONS.toLocaleString()} · random salt &amp; IV</Text>
      </Group>
      {error && <Alert color="red" p="xs">{error}</Alert>}
      {output && <OutputArea label={mode === 'encrypt' ? 'Ciphertext (Base64)' : 'Plaintext'} value={output} filename={mode === 'encrypt' ? 'encrypted.txt' : 'decrypted.txt'} minRows={4} />}
    </Stack>
  );
}

function FileMode() {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const run = async (encrypt) => {
    setBusy(true); setError(null); setDone(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (encrypt) {
        const out = await encryptWithPassword(password, bytes);
        downloadBlob(new Blob([out]), `${file.name}.enc`);
        setDone(`Encrypted → ${file.name}.enc (${formatBytes(out.length)})`);
      } else {
        const out = await decryptWithPassword(password, bytes);
        const name = file.name.replace(/\.enc$/i, '') || 'decrypted.bin';
        downloadBlob(new Blob([out]), name === file.name ? `decrypted_${name}` : name);
        setDone(`Decrypted → ${name} (${formatBytes(out.length)})`);
      }
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <Stack gap="md">
      <FileDropZone onFile={setFile} title="Drop a file to encrypt, or a .enc file to decrypt" maxSize={1024 * 1024 * 1024} />
      {file && <Group gap="xs"><Badge variant="light">{file.name}</Badge><Badge variant="light" color="gray">{formatBytes(file.size)}</Badge></Group>}
      <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} autoComplete="new-password" />
      <Group>
        <Button leftSection={<IconLock size={16} />} onClick={() => run(true)} loading={busy} disabled={!file || !password}>Encrypt &amp; download</Button>
        <Button variant="light" leftSection={<IconLockOpen size={16} />} onClick={() => run(false)} loading={busy} disabled={!file || !password}>Decrypt &amp; download</Button>
      </Group>
      {error && <Alert color="red" p="xs">{error}</Alert>}
      {done && <Alert color="teal" p="xs">{done}</Alert>}
      <Text size="xs" c="dimmed">Files are read into memory, so very large files (&gt;1 GB) may exceed browser limits.</Text>
    </Stack>
  );
}

const IV_SIZES = { 'AES-GCM': 12, 'AES-CBC': 16, 'AES-CTR': 16 };

function decodeInput(text, fmt) {
  if (fmt === 'hex') return hexToBytes(text);
  if (fmt === 'base64') return base64ToBytes(text);
  return utf8Encode(text);
}

function RawMode() {
  const [algo, setAlgo] = useState('AES-GCM');
  const [key, setKey] = useState(() => bytesToHex(randomBytes(32)));
  const [iv, setIv] = useState(() => bytesToHex(randomBytes(12)));
  const [mode, setMode] = useState('encrypt');
  const [input, setInput] = useState('');
  const [inFmt, setInFmt] = useState('text');
  const [outFmt, setOutFmt] = useState('hex');
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);

  const changeAlgo = (a) => { setAlgo(a); setIv(bytesToHex(randomBytes(IV_SIZES[a]))); };

  const run = async () => {
    setError(null); setOutput('');
    try {
      const k = hexToBytes(key);
      if (![16, 24, 32].includes(k.length)) throw new Error(`Key must be 16, 24 or 32 bytes (got ${k.length}).`);
      const ivBytes = hexToBytes(iv);
      if (ivBytes.length !== IV_SIZES[algo]) throw new Error(`${algo} needs a ${IV_SIZES[algo]}-byte IV (got ${ivBytes.length}).`);
      const cryptoKey = await crypto.subtle.importKey('raw', k, algo, false, ['encrypt', 'decrypt']);
      const params = algo === 'AES-CTR' ? { name: algo, counter: ivBytes, length: 64 } : { name: algo, iv: ivBytes };
      const data = decodeInput(input.trim() && inFmt !== 'text' ? input.trim() : input, inFmt);
      const result = new Uint8Array(await crypto.subtle[mode](params, cryptoKey, data));
      setOutput(outFmt === 'hex' ? bytesToHex(result) : outFmt === 'base64' ? bytesToBase64(result) : utf8Decode(result));
    } catch (e) { setError(e.message || 'Operation failed (wrong key/IV or corrupted data)'); }
  };

  return (
    <Stack gap="md">
      <Group align="flex-end">
        <Select label="Algorithm" value={algo} onChange={changeAlgo} data={Object.keys(IV_SIZES)} allowDeselect={false} w={140} />
        <SegmentedControl value={mode} onChange={(v) => { setMode(v); setInFmt(v === 'encrypt' ? 'text' : 'hex'); setOutFmt(v === 'encrypt' ? 'hex' : 'text'); }}
          data={[{ value: 'encrypt', label: 'Encrypt' }, { value: 'decrypt', label: 'Decrypt' }]} />
      </Group>
      <Group align="flex-end" wrap="nowrap">
        <TextInput label="Key (hex)" value={key} onChange={(e) => setKey(e.currentTarget.value)} style={{ flex: 1 }} className="code-font" />
        <Button variant="subtle" size="xs" onClick={() => setKey(bytesToHex(randomBytes(32)))}>Random 256-bit</Button>
      </Group>
      <Group align="flex-end" wrap="nowrap">
        <TextInput label={`IV / nonce (hex, ${IV_SIZES[algo]} bytes)`} value={iv} onChange={(e) => setIv(e.currentTarget.value)} style={{ flex: 1 }} className="code-font" />
        <Button variant="subtle" size="xs" onClick={() => setIv(bytesToHex(randomBytes(IV_SIZES[algo])))}>Random</Button>
      </Group>
      <Textarea label={<Group gap="xs">Input <SegmentedControl size="xs" value={inFmt} onChange={setInFmt} data={['text', 'hex', 'base64']} /></Group>}
        value={input} onChange={(e) => setInput(e.currentTarget.value)} autosize minRows={4} className="code-font" />
      <Group>
        <Button onClick={run} disabled={!input}>{mode === 'encrypt' ? 'Encrypt' : 'Decrypt'}</Button>
        <Text size="sm">Output as</Text>
        <SegmentedControl size="xs" value={outFmt} onChange={setOutFmt} data={['hex', 'base64', 'text']} />
      </Group>
      {algo === 'AES-GCM' && <Text size="xs" c="dimmed">GCM output includes the 16-byte authentication tag at the end. Never reuse a key + IV pair.</Text>}
      {algo === 'AES-CBC' && <Text size="xs" c="dimmed">CBC uses PKCS#7 padding and has no integrity check — prefer GCM for new designs.</Text>}
      {error && <Alert color="red" p="xs">{error}</Alert>}
      {output && <OutputArea value={output} minRows={3} />}
    </Stack>
  );
}

export default function AesCrypto() {
  const [tab, setTab] = useState('password');
  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="password" leftSection={<IconLock size={14} />}>Text (password)</Tabs.Tab>
          <Tabs.Tab value="file" leftSection={<IconFile size={14} />}>File</Tabs.Tab>
          <Tabs.Tab value="raw" leftSection={<IconSettings size={14} />}>Raw key / IV</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <Panel>
        {tab === 'password' && <PasswordMode />}
        {tab === 'file' && <FileMode />}
        {tab === 'raw' && <RawMode />}
      </Panel>
      <PrivacyNote>Encryption uses the browser&apos;s native Web Crypto API. Keys and plaintext never leave this page.</PrivacyNote>
    </Stack>
  );
}
