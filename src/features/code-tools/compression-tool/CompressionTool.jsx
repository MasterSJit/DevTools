import { useEffect, useState } from 'react';
import { Stack, Group, SegmentedControl, Select, SimpleGrid, Alert, Text } from '@mantine/core';
import { IconFileZip } from '@tabler/icons-react';
import { InputArea, OutputArea, Stat, PrivacyNote, Panel } from '@/shared/components/ui';
import FileDropZone from '@/shared/components/FileDropZone';
import { utf8Encode, bytesToBase64, base64ToBytes, bytesToHex, hexToBytes } from '@/shared/lib/encoding';
import { bytesToText } from '@/shared/lib/codecs';
import { downloadBlob, formatBytes } from '@/shared/lib/download';

const FORMATS = [
  { value: 'gzip', label: 'Gzip (.gz)' },
  { value: 'deflate', label: 'Deflate / zlib' },
  { value: 'deflate-raw', label: 'Raw deflate' },
];

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}
const compress = (bytes, fmt) => pipe(bytes, new CompressionStream(fmt));
const decompress = (bytes, fmt) => pipe(bytes, new DecompressionStream(fmt));

/** Guess the format from magic bytes: 1f 8b = gzip, 78 xx = zlib. */
function sniff(bytes) {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return 'gzip';
  if (bytes[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(bytes[1])) return 'deflate';
  return null;
}

const parseIn = (s, enc) => (enc === 'base64' ? base64ToBytes(s.trim()) : enc === 'hex' ? hexToBytes(s) : utf8Encode(s));
const formatOut = (b, enc) => (enc === 'base64' ? bytesToBase64(b) : enc === 'hex' ? bytesToHex(b) : bytesToText(b));

export default function CompressionTool() {
  const [mode, setMode] = useState('compress');
  const [fmt, setFmt] = useState('gzip');
  const [inEnc, setInEnc] = useState('text');
  const [outEnc, setOutEnc] = useState('base64');
  const [input, setInput] = useState('{"user":"admin","roles":["read","write"],"note":"repeat repeat repeat repeat repeat"}');
  const [result, setResult] = useState({});

  // Sensible defaults when switching direction.
  const switchMode = (m) => {
    setMode(m);
    if (m === 'decompress') { setInEnc('base64'); setOutEnc('text'); } else { setInEnc('text'); setOutEnc('base64'); }
    setInput(m === 'decompress' && result.bytes ? bytesToBase64(result.bytes) : input);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!input) { setResult({}); return; }
      try {
        const src = parseIn(input, inEnc);
        let useFmt = fmt;
        let note;
        if (mode === 'decompress') {
          const s = sniff(src);
          if (s && s !== fmt) { useFmt = s; note = `Detected ${s} from magic bytes.`; }
        }
        const out = mode === 'compress' ? await compress(src, useFmt) : await decompress(src, useFmt);
        if (alive) setResult({ bytes: out, inSize: src.length, outSize: out.length, text: formatOut(out, outEnc), note });
      } catch (e) {
        if (alive) setResult({ error: e.message || 'Could not process input — wrong format or corrupt data?' });
      }
    })();
    return () => { alive = false; };
  }, [input, inEnc, outEnc, fmt, mode]);

  const onFile = async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      const auto = sniff(bytes);
      const isCompressed = !!auto || /\.(gz|zz|deflate)$/i.test(file.name);
      const out = isCompressed ? await decompress(bytes, auto || fmt) : await compress(bytes, fmt);
      const name = isCompressed ? file.name.replace(/\.(gz|zz|deflate)$/i, '') || 'decompressed.bin' : `${file.name}${fmt === 'gzip' ? '.gz' : '.zz'}`;
      downloadBlob(new Blob([out]), name);
      setResult({ fileNote: `${isCompressed ? 'Decompressed' : 'Compressed'} ${file.name}: ${formatBytes(bytes.length)} → ${formatBytes(out.length)} (downloaded as ${name})` });
    } catch (e) { setResult({ error: e.message }); }
  };

  const ratio = result.inSize ? ((1 - result.outSize / result.inSize) * 100).toFixed(1) : null;

  return (
    <Stack gap="md">
      <Group wrap="wrap">
        <SegmentedControl value={mode} onChange={switchMode} data={[{ value: 'compress', label: 'Compress' }, { value: 'decompress', label: 'Decompress' }]} />
        <Select value={fmt} onChange={setFmt} data={FORMATS} allowDeselect={false} w={180} />
        <Select label={null} value={inEnc} onChange={setInEnc} allowDeselect={false} w={150}
          data={[{ value: 'text', label: 'Input: text' }, { value: 'base64', label: 'Input: Base64' }, { value: 'hex', label: 'Input: Hex' }]} />
        <Select value={outEnc} onChange={setOutEnc} allowDeselect={false} w={160}
          data={[{ value: 'base64', label: 'Output: Base64' }, { value: 'hex', label: 'Output: Hex' }, { value: 'text', label: 'Output: text' }]} />
      </Group>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <InputArea value={input} onChange={setInput} minRows={8} onFile={false} />
        <OutputArea value={result.text || ''} minRows={8} filename={mode === 'compress' ? 'compressed.txt' : 'decompressed.txt'} />
      </SimpleGrid>
      {result.error && <Alert color="red" p="xs">{result.error}</Alert>}
      {result.note && <Text size="xs" c="teal">{result.note}</Text>}
      {result.inSize != null && (
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          <Stat label="Input bytes" value={formatBytes(result.inSize)} />
          <Stat label="Output bytes" value={formatBytes(result.outSize)} />
          <Stat label={mode === 'compress' ? 'Saved' : 'Expansion'} value={mode === 'compress' ? `${ratio}%` : `${(result.outSize / result.inSize).toFixed(1)}×`} color={mode === 'compress' && ratio < 0 ? 'orange' : undefined} />
        </SimpleGrid>
      )}
      <Panel title="Files" icon={IconFileZip}>
        <FileDropZone onFile={onFile} title="Drop a file — .gz / zlib files are decompressed, anything else is compressed" height={100} />
        {result.fileNote && <Text size="sm" mt="xs">{result.fileNote}</Text>}
      </Panel>
      <PrivacyNote>Uses the browser’s native CompressionStream — handy for decoding gzip+Base64 blobs from cookies, JWTs, SAML and HTTP traffic.</PrivacyNote>
    </Stack>
  );
}
