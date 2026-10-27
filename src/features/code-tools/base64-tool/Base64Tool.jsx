import { useMemo, useState } from 'react';
import { Tabs, Stack, Group, Switch, SegmentedControl, SimpleGrid, Text, Badge, Button, Alert, Image, Textarea } from '@mantine/core';
import { IconDownload, IconFile, IconLetterCase, IconPhoto } from '@tabler/icons-react';
import FileDropZone from '@/shared/components/FileDropZone';
import CopyButton from '@/shared/components/CopyButton';
import { InputArea, OutputArea, Panel } from '@/shared/components/ui';
import { bytesToBase64, base64ToBytes, utf8Encode, tryUtf8, hexdump } from '@/shared/lib/encoding';
import { downloadBlob, formatBytes } from '@/shared/lib/download';
import { detectType } from '@/features/security-tools/file-inspector/signatures';

const MIME_BY_NAME = { 'PNG image': 'image/png', 'JPEG image': 'image/jpeg', 'GIF image': 'image/gif', 'WebP image': 'image/webp', 'PDF document': 'application/pdf', 'BMP image': 'image/bmp' };

function TextMode() {
  const [mode, setMode] = useState('encode');
  const [input, setInput] = useState('Hello, DevForge! 👋');
  const [urlSafe, setUrlSafe] = useState(false);
  const [wrap, setWrap] = useState(false);

  const result = useMemo(() => {
    if (!input) return { value: '' };
    try {
      if (mode === 'encode') {
        let b = bytesToBase64(utf8Encode(input));
        if (urlSafe) b = b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        if (wrap) b = b.match(/.{1,76}/g).join('\n');
        return { value: b };
      }
      const bytes = base64ToBytes(input);
      const text = tryUtf8(bytes);
      return text === null ? { value: hexdump(bytes), note: 'Decoded data is binary (not UTF-8) — showing hexdump. Use the “Base64 → File” tab to save it.' } : { value: text };
    } catch (e) { return { error: e.message }; }
  }, [input, mode, urlSafe, wrap]);

  return (
    <Stack gap="md">
      <Group>
        <SegmentedControl value={mode} onChange={setMode} data={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />
        {mode === 'encode' && <Switch size="xs" label="URL-safe (Base64URL, no padding)" checked={urlSafe} onChange={(e) => setUrlSafe(e.currentTarget.checked)} />}
        {mode === 'encode' && <Switch size="xs" label="Wrap at 76 chars (MIME)" checked={wrap} onChange={(e) => setWrap(e.currentTarget.checked)} />}
        <Button size="xs" variant="light" disabled={!result.value} onClick={() => { setInput(result.value); setMode(mode === 'encode' ? 'decode' : 'encode'); }}>Swap</Button>
      </Group>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <InputArea label={mode === 'encode' ? 'Text' : 'Base64 / Base64URL'} value={input} onChange={setInput} minRows={8} />
        <OutputArea label={mode === 'encode' ? 'Base64' : 'Decoded'} value={result.value || ''} minRows={8} />
      </SimpleGrid>
      {result.error && <Alert color="red" p="xs">{result.error}</Alert>}
      {result.note && <Alert color="orange" p="xs">{result.note}</Alert>}
      <Text size="xs" c="dimmed">{utf8Encode(input).length} bytes in · UTF-8 safe (emoji and non-Latin text work)</Text>
    </Stack>
  );
}

function FileToBase64() {
  const [file, setFile] = useState(null);
  const [b64, setB64] = useState('');
  const [asDataUri, setAsDataUri] = useState(true);

  const onFile = async (f) => {
    setFile(f);
    setB64(bytesToBase64(new Uint8Array(await f.arrayBuffer())));
  };
  const value = b64 ? (asDataUri ? `data:${file.type || 'application/octet-stream'};base64,${b64}` : b64) : '';

  return (
    <Stack gap="md">
      <FileDropZone onFile={onFile} title="Drop any file to encode as Base64" maxSize={25 * 1024 * 1024} />
      {file && (
        <>
          <Group>
            <Badge variant="light">{file.name}</Badge>
            <Badge variant="light" color="gray">{formatBytes(file.size)} → {formatBytes(value.length)}</Badge>
            <Switch size="xs" label="Data URI prefix" checked={asDataUri} onChange={(e) => setAsDataUri(e.currentTarget.checked)} />
          </Group>
          {file.type.startsWith('image/') && (
            <Panel title="Usage">
              <Group gap="xs">
                <CopyButton value={`<img src="${value.startsWith('data:') ? value : `data:${file.type};base64,${value}`}" alt="" />`} />
                <Text size="xs" c="dimmed">HTML &lt;img&gt;</Text>
                <CopyButton value={`background-image: url("${value.startsWith('data:') ? value : `data:${file.type};base64,${value}`}");`} />
                <Text size="xs" c="dimmed">CSS background</Text>
              </Group>
            </Panel>
          )}
          <OutputArea label="Base64" value={value} filename={`${file.name}.b64.txt`} minRows={6} maxRows={12} />
        </>
      )}
    </Stack>
  );
}

function Base64ToFile() {
  const [input, setInput] = useState('');
  const decoded = useMemo(() => {
    if (!input.trim()) return null;
    try {
      const declared = input.match(/^data:([^;,]+)/)?.[1];
      const bytes = base64ToBytes(input.trim());
      const type = detectType(bytes)[0];
      const mime = declared || MIME_BY_NAME[type?.name] || 'application/octet-stream';
      return { bytes, type, mime, ext: type?.exts?.[0] || 'bin', url: URL.createObjectURL(new Blob([bytes], { type: mime })) };
    } catch (e) { return { error: e.message }; }
  }, [input]);

  return (
    <Stack gap="md">
      <Textarea label="Base64 or data: URI" value={input} onChange={(e) => setInput(e.currentTarget.value)} autosize minRows={5} maxRows={12} className="code-font" />
      {decoded?.error && <Alert color="red" p="xs">{decoded.error}</Alert>}
      {decoded?.bytes && (
        <Panel title="Decoded file" actions={
          <Button size="xs" leftSection={<IconDownload size={14} />} onClick={() => downloadBlob(new Blob([decoded.bytes], { type: decoded.mime }), `decoded.${decoded.ext}`)}>Download</Button>
        }>
          <Group gap="xs" mb="sm">
            <Badge variant="light">{decoded.type?.name || 'Unknown type'}</Badge>
            <Badge variant="light" color="gray">{formatBytes(decoded.bytes.length)}</Badge>
            <Badge variant="outline" color="gray" tt="none">{decoded.mime}</Badge>
          </Group>
          {decoded.mime.startsWith('image/') && <Image src={decoded.url} mah={300} fit="contain" radius="md" className="df-checker" />}
          {!decoded.mime.startsWith('image/') && (
            <Textarea readOnly value={tryUtf8(decoded.bytes) ?? hexdump(decoded.bytes.subarray(0, 512))} autosize minRows={4} maxRows={12} className="code-font" />
          )}
        </Panel>
      )}
    </Stack>
  );
}

export default function Base64Tool() {
  const [tab, setTab] = useState('text');
  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="text" leftSection={<IconLetterCase size={14} />}>Text</Tabs.Tab>
          <Tabs.Tab value="file" leftSection={<IconFile size={14} />}>File → Base64</Tabs.Tab>
          <Tabs.Tab value="tofile" leftSection={<IconPhoto size={14} />}>Base64 → File</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'text' && <TextMode />}
      {tab === 'file' && <FileToBase64 />}
      {tab === 'tofile' && <Base64ToFile />}
    </Stack>
  );
}
