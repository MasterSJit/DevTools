import { useState, useEffect, useMemo } from 'react';
import {
  Stack, Group, Paper, Text, Tabs, Badge, SegmentedControl, Switch, TextInput, Textarea, Loader, Checkbox,
} from '@mantine/core';
import { IconHash, IconFile, IconCircleCheck } from '@tabler/icons-react';
import CopyButton from '@/shared/components/CopyButton';
import FileDropZone from '@/shared/components/FileDropZone';
import { Panel, PrivacyNote } from '@/shared/components/ui';
import { HASH_ALGOS, digest, hmac } from '@/shared/lib/crypto';
import { bytesToHex, bytesToBase64 } from '@/shared/lib/encoding';
import { formatBytes } from '@/shared/lib/download';
import { useDebounce } from '@/shared/hooks/useDebounce';

const HMAC_ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

function format(bytes, fmt) {
  if (fmt === 'base64') return bytesToBase64(bytes);
  const hex = bytesToHex(bytes);
  return fmt === 'HEX' ? hex.toUpperCase() : hex;
}

export default function HashGenerator() {
  const [tab, setTab] = useState('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [fileBytes, setFileBytes] = useState(null);
  const [useHmac, setUseHmac] = useState(false);
  const [hmacKey, setHmacKey] = useState('');
  const [fmt, setFmt] = useState('hex');
  const [compare, setCompare] = useState('');
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState(false);
  const [algos, setAlgos] = useState(HASH_ALGOS);

  const debouncedText = useDebounce(text, 200);
  const data = tab === 'text' ? debouncedText : fileBytes;

  useEffect(() => {
    let cancelled = false;
    if (data == null || (tab === 'file' && !fileBytes)) { setResults({}); return; }
    setBusy(true);
    (async () => {
      const out = {};
      for (const algo of algos) {
        if (useHmac && !HMAC_ALGOS.includes(algo)) continue;
        out[algo] = useHmac ? await hmac(algo, hmacKey, data) : await digest(algo, data);
      }
      if (!cancelled) { setResults(out); setBusy(false); }
    })().catch(() => !cancelled && setBusy(false));
    return () => { cancelled = true; };
  }, [data, tab, fileBytes, useHmac, hmacKey, algos]);

  const onFile = async (f) => {
    setFile(f);
    setFileBytes(new Uint8Array(await f.arrayBuffer()));
  };

  const cmp = compare.trim().toLowerCase().replace(/\s/g, '');
  const matchAlgo = useMemo(() => {
    if (!cmp) return null;
    for (const [algo, bytes] of Object.entries(results)) {
      if (bytesToHex(bytes) === cmp || bytesToBase64(bytes).toLowerCase() === cmp) return algo;
    }
    return false;
  }, [cmp, results]);

  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="text" leftSection={<IconHash size={14} />}>Text</Tabs.Tab>
          <Tabs.Tab value="file" leftSection={<IconFile size={14} />}>File</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {tab === 'text' ? (
        <Textarea value={text} onChange={(e) => setText(e.currentTarget.value)} placeholder="Type or paste text — hashes update live…"
          autosize minRows={4} maxRows={12} className="code-font" />
      ) : (
        <Stack gap="xs">
          <FileDropZone onFile={onFile} title="Drop any file to hash (processed locally)" maxSize={2 * 1024 * 1024 * 1024} />
          {file && <Group gap="xs"><Badge variant="light">{file.name}</Badge><Badge variant="light" color="gray">{formatBytes(file.size)}</Badge></Group>}
        </Stack>
      )}

      <Paper p="sm">
        <Group gap="lg" wrap="wrap">
          <SegmentedControl size="xs" value={fmt} onChange={setFmt}
            data={[{ value: 'hex', label: 'hex' }, { value: 'HEX', label: 'HEX' }, { value: 'base64', label: 'Base64' }]} />
          <Switch label="HMAC" checked={useHmac} onChange={(e) => setUseHmac(e.currentTarget.checked)} />
          {useHmac && (
            <TextInput size="xs" placeholder="HMAC secret key" value={hmacKey} onChange={(e) => setHmacKey(e.currentTarget.value)} w={260} />
          )}
          <Checkbox.Group value={algos} onChange={setAlgos}>
            <Group gap="sm">
              {HASH_ALGOS.map((a) => <Checkbox key={a} value={a} label={a} size="xs" />)}
            </Group>
          </Checkbox.Group>
          {busy && <Loader size="xs" />}
        </Group>
      </Paper>

      <Panel title={useHmac ? 'HMAC digests' : 'Digests'}>
        <Stack gap={6}>
          {Object.keys(results).length === 0 && <Text size="sm" c="dimmed">Enter text or drop a file.</Text>}
          {Object.entries(results).map(([algo, bytes]) => {
            const value = format(bytes, fmt);
            const isMatch = matchAlgo === algo;
            return (
              <Group key={algo} wrap="nowrap" gap="sm" align="flex-start"
                className={`rounded-lg px-2 py-1 ${isMatch ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40' : ''}`}>
                <Badge variant="light" w={86} style={{ flexShrink: 0 }} color={isMatch ? 'teal' : undefined}>{algo}</Badge>
                <Text size="sm" ff="monospace" style={{ wordBreak: 'break-all', flex: 1 }}>{value}</Text>
                <CopyButton value={value} icon />
              </Group>
            );
          })}
          {algos.includes('MD5') || algos.includes('SHA-1') ? (
            <Text size="xs" c="dimmed" mt={4}>MD5 and SHA-1 are fine for checksums but broken for security — use SHA-256+ (or bcrypt/Argon2 for passwords).</Text>
          ) : null}
        </Stack>
      </Panel>

      <Panel title="Verify a checksum" icon={IconCircleCheck}>
        <TextInput placeholder="Paste an expected hash (hex or Base64) to compare against the digests above"
          value={compare} onChange={(e) => setCompare(e.currentTarget.value)} className="code-font" />
        {cmp && matchAlgo && <Badge mt="sm" color="teal" size="lg">✓ Matches {matchAlgo}</Badge>}
        {cmp && matchAlgo === false && <Badge mt="sm" color="red" size="lg">✗ No match with any computed digest</Badge>}
      </Panel>
      <PrivacyNote />
    </Stack>
  );
}
