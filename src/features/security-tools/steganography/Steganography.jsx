import { useEffect, useRef, useState } from 'react';
import { Stack, SegmentedControl, SimpleGrid, Textarea, PasswordInput, Button, Alert, Text, Group, Image, Select } from '@mantine/core';
import { IconDownload, IconEye } from '@tabler/icons-react';
import FileDropZone from '@/shared/components/FileDropZone';
import { Panel, PrivacyNote } from '@/shared/components/ui';
import CopyButton from '@/shared/components/CopyButton';
import { utf8Encode, utf8Decode } from '@/shared/lib/encoding';
import { downloadBlob } from '@/shared/lib/download';

const MAGIC = [0x44, 0x46, 0x53, 0x31]; // "DFS1" header so we can tell our payloads apart from noise

// Optional AES-GCM layer so a found payload is still unreadable without the password.
async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', utf8Encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(text, password) {
  const data = utf8Encode(text);
  if (!password) return new Uint8Array([0, ...data]);
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(password, salt), data));
  return new Uint8Array([1, ...salt, ...iv, ...ct]);
}
async function unseal(bytes, password) {
  if (bytes[0] === 0) return utf8Decode(bytes.subarray(1));
  if (!password) throw new Error('This payload is encrypted — enter the password.');
  const salt = bytes.subarray(1, 17), iv = bytes.subarray(17, 29), ct = bytes.subarray(29);
  try {
    return utf8Decode(new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await deriveKey(password, salt), ct)));
  } catch { throw new Error('Wrong password or corrupted image.'); }
}

/** Write bits into the low bit(s) of R, G, B channels. */
function embed(img, payload, bitsPerChannel) {
  const header = [...MAGIC, (payload.length >>> 24) & 255, (payload.length >>> 16) & 255, (payload.length >>> 8) & 255, payload.length & 255];
  const all = new Uint8Array([...header, ...payload]);
  const px = img.data;
  const capacity = Math.floor(((px.length / 4) * 3 * bitsPerChannel) / 8);
  if (all.length > capacity) throw new Error(`Message too large: needs ${all.length} bytes, image holds ${capacity}.`);
  const mask = (1 << bitsPerChannel) - 1;
  let bitPos = 0;
  const totalBits = all.length * 8;
  for (let i = 0; i < px.length && bitPos < totalBits; i++) {
    if (i % 4 === 3) continue; // skip alpha
    let v = 0;
    for (let b = 0; b < bitsPerChannel; b++) {
      const bit = bitPos < totalBits ? (all[bitPos >> 3] >> (7 - (bitPos & 7))) & 1 : 0;
      v = (v << 1) | bit; bitPos++;
    }
    px[i] = (px[i] & ~mask) | v;
  }
  return capacity;
}

function extract(img, bitsPerChannel) {
  const px = img.data;
  const readBytes = (start, count) => {
    const out = new Uint8Array(count);
    let bitPos = 0;
    const startBit = start * 8;
    const endBit = startBit + count * 8;
    let globalBit = 0;
    for (let i = 0; i < px.length && globalBit < endBit; i++) {
      if (i % 4 === 3) continue;
      for (let b = bitsPerChannel - 1; b >= 0; b--) {
        if (globalBit >= startBit && globalBit < endBit) {
          const bit = (px[i] >> b) & 1;
          out[bitPos >> 3] |= bit << (7 - (bitPos & 7));
          bitPos++;
        }
        globalBit++;
      }
    }
    return out;
  };
  const head = readBytes(0, 8);
  if (!MAGIC.every((m, i) => head[i] === m)) throw new Error('No hidden DevForge message found (try the other bit depth).');
  const len = ((head[4] << 24) | (head[5] << 16) | (head[6] << 8) | head[7]) >>> 0;
  if (len > px.length) throw new Error('Corrupt header.');
  return readBytes(8, len);
}

async function loadImageData(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  return { canvas: c, ctx, data: ctx.getImageData(0, 0, c.width, c.height) };
}

export default function Steganography() {
  const [mode, setMode] = useState('hide');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('Meet at the usual place at 9.');
  const [password, setPassword] = useState('');
  const [bits, setBits] = useState('1');
  const [out, setOut] = useState({});
  const lsbRef = useRef(null);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const onFile = (f) => { setFile(f); setPreview(URL.createObjectURL(f)); setOut({}); };

  const hide = async () => {
    try {
      const { canvas, ctx, data } = await loadImageData(file);
      const payload = await seal(message, password);
      const cap = embed(data, payload, Number(bits));
      ctx.putImageData(data, 0, 0);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, '')}-stego.png`);
      setOut({ ok: `Hidden ${payload.length} bytes (${((payload.length + 8) / cap * 100).toFixed(2)}% of capacity). Saved as PNG — re-saving as JPEG or uploading to social media will destroy the message.` });
    } catch (e) { setOut({ error: e.message }); }
  };

  const reveal = async () => {
    try {
      const { data } = await loadImageData(file);
      setOut({ text: await unseal(extract(data, Number(bits)), password) });
    } catch (e) { setOut({ error: e.message }); }
  };

  // LSB bit-plane view: highlights hidden data / noise patterns (classic CTF check).
  const showPlane = async () => {
    const { canvas, ctx, data } = await loadImageData(file);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      px[i] = (px[i] & 1) * 255; px[i + 1] = (px[i + 1] & 1) * 255; px[i + 2] = (px[i + 2] & 1) * 255;
    }
    ctx.putImageData(data, 0, 0);
    lsbRef.current = canvas.toDataURL();
    setOut({ plane: lsbRef.current });
  };

  return (
    <Stack gap="md">
      <Group>
        <SegmentedControl value={mode} onChange={(m) => { setMode(m); setOut({}); }} data={[{ value: 'hide', label: 'Hide message' }, { value: 'reveal', label: 'Reveal message' }]} />
        <Select value={bits} onChange={setBits} allowDeselect={false} w={190}
          data={[{ value: '1', label: '1 bit / channel (stealthy)' }, { value: '2', label: '2 bits / channel (more room)' }]} />
      </Group>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title="Cover image">
          <FileDropZone onFile={onFile} accept={['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/gif']} title="Drop an image (PNG recommended)" />
          {preview && <Image src={preview} mah={260} fit="contain" mt="sm" radius="sm" alt="cover" />}
        </Panel>
        <Panel title={mode === 'hide' ? 'Secret message' : 'Result'}>
          <Stack gap="sm">
            {mode === 'hide' && <Textarea value={message} onChange={(e) => setMessage(e.currentTarget.value)} autosize minRows={5} />}
            <PasswordInput label="Password (optional — encrypts with AES-256-GCM)" value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
            <Group>
              {mode === 'hide'
                ? <Button leftSection={<IconDownload size={16} />} disabled={!file || !message} onClick={hide}>Hide & download PNG</Button>
                : <Button leftSection={<IconEye size={16} />} disabled={!file} onClick={reveal}>Reveal</Button>}
              <Button variant="light" disabled={!file} onClick={showPlane}>Show LSB plane</Button>
            </Group>
            {out.error && <Alert color="red" p="xs">{out.error}</Alert>}
            {out.ok && <Alert color="teal" p="xs">{out.ok}</Alert>}
            {out.text != null && (
              <Panel title="Hidden message" actions={<CopyButton value={out.text} icon />} p="xs">
                <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{out.text}</Text>
              </Panel>
            )}
          </Stack>
        </Panel>
      </SimpleGrid>
      {out.plane && (
        <Panel title="Least-significant-bit plane">
          <Text size="xs" c="dimmed" mb="xs">Natural photos look like random noise here; blocky or striped regions at the top usually mean hidden data.</Text>
          <Image src={out.plane} mah={400} fit="contain" alt="LSB plane" />
        </Panel>
      )}
      <PrivacyNote />
    </Stack>
  );
}
