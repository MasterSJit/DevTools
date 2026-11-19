import { useEffect, useState } from 'react';
import { Stack, SimpleGrid, SegmentedControl, TextInput, Group, Badge, Text, Alert, Textarea, Switch } from '@mantine/core';
import { Panel, KVTable, OutputArea, PrivacyNote } from '@/shared/components/ui';
import FileDropZone from '@/shared/components/FileDropZone';
import { utf8Encode, bytesToBase64 } from '@/shared/lib/encoding';
import { formatBytes } from '@/shared/lib/download';

const ALGOS = [['sha256', 'SHA-256'], ['sha384', 'SHA-384'], ['sha512', 'SHA-512']];

async function digestAll(bytes) {
  const out = {};
  for (const [id, name] of ALGOS) out[id] = `${id}-${bytesToBase64(new Uint8Array(await crypto.subtle.digest(name, bytes)))}`;
  return out;
}

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export default function SriGenerator() {
  const [mode, setMode] = useState('text');
  const [text, setText] = useState('console.log("hello from a CDN");\n');
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('https://cdn.example.com/lib/app.min.js');
  const [algo, setAlgo] = useState('sha384');
  const [all, setAll] = useState(false);
  const [hashes, setHashes] = useState(null);
  const [verify, setVerify] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const bytes = mode === 'file' ? (file ? new Uint8Array(await file.arrayBuffer()) : null) : utf8Encode(text);
      if (!bytes) { setHashes(null); return; }
      const h = await digestAll(bytes);
      if (alive) setHashes({ ...h, size: bytes.length });
    })();
    return () => { alive = false; };
  }, [mode, text, file]);

  const integrity = hashes ? (all ? ALGOS.map(([id]) => hashes[id]).join(' ') : hashes[algo]) : '';
  const isCss = /\.css(\?|#|$)/i.test(url) || file?.name?.endsWith('.css');
  const safeUrl = /^https:\/\//i.test(url) ? url : '';
  const tag = !integrity ? '' : isCss
    ? `<link rel="stylesheet" href="${escAttr(safeUrl || 'https://…')}" integrity="${integrity}" crossorigin="anonymous">`
    : `<script src="${escAttr(safeUrl || 'https://…')}" integrity="${integrity}" crossorigin="anonymous"></script>`;

  const v = verify.trim();
  const verifyResult = !v || !hashes ? null
    : v.split(/\s+/).some((tok) => ALGOS.some(([id]) => hashes[id] === tok)) ? 'match' : 'mismatch';

  return (
    <Stack gap="md">
      <Alert variant="light" color="blue" p="xs">
        <Text size="xs">Subresource Integrity makes the browser refuse a CDN file if its bytes change, so a hacked or hijacked CDN cannot inject code into your site.</Text>
      </Alert>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title="Resource">
          <Stack gap="sm">
            <SegmentedControl value={mode} onChange={setMode} data={[{ value: 'text', label: 'Paste content' }, { value: 'file', label: 'File' }]} />
            {mode === 'text'
              ? <Textarea value={text} onChange={(e) => setText(e.currentTarget.value)} autosize minRows={8} maxRows={16} className="code-font" spellCheck={false} />
              : <FileDropZone onFile={setFile} title={file ? `${file.name} · ${formatBytes(file.size)}` : 'Drop the exact .js / .css file served by the CDN'} />}
            <TextInput label="Public URL of the file" value={url} onChange={(e) => setUrl(e.currentTarget.value)}
              error={url && !/^https:\/\//i.test(url) ? 'SRI resources should be served over https://' : null} />
            <Group>
              <SegmentedControl size="xs" value={algo} onChange={setAlgo} disabled={all} data={ALGOS.map(([id, l]) => ({ value: id, label: l }))} />
              <Switch size="sm" label="Include all three" checked={all} onChange={(e) => setAll(e.currentTarget.checked)} />
            </Group>
          </Stack>
        </Panel>
        <Stack gap="md">
          <OutputArea label="HTML tag" value={tag} minRows={3} filename="sri-tag.html" />
          <Panel title="Hashes" actions={hashes && <Badge variant="light">{formatBytes(hashes.size)}</Badge>}>
            {hashes && <KVTable labelWidth={90} rows={ALGOS.map(([id, l]) => [l, hashes[id]])} />}
          </Panel>
          <Panel title="Verify an existing integrity value">
            <TextInput placeholder="sha384-…" value={verify} onChange={(e) => setVerify(e.currentTarget.value)} />
            {verifyResult && (
              <Alert mt="xs" p="xs" variant="light" color={verifyResult === 'match' ? 'teal' : 'red'}>
                {verifyResult === 'match' ? 'Matches this content — the browser will load it.' : 'Does not match — the browser would block this file.'}
              </Alert>
            )}
          </Panel>
        </Stack>
      </SimpleGrid>
      <Text size="xs" c="dimmed">Note: the file must be served with CORS (Access-Control-Allow-Origin) for <code>crossorigin=&quot;anonymous&quot;</code> to work. Hash the exact bytes the CDN serves — minified and unminified files differ.</Text>
      <PrivacyNote />
    </Stack>
  );
}
