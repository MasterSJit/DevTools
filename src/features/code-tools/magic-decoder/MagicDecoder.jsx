import { useEffect, useMemo, useState } from 'react';
import { Stack, Group, Text, Badge, Paper, Slider, Alert, Textarea, Button } from '@mantine/core';
import { IconWand, IconArrowRight, IconInfoCircle } from '@tabler/icons-react';
import { InputArea, PrivacyNote } from '@/shared/components/ui';
import CopyButton from '@/shared/components/CopyButton';
import { magicDecode, CODEC_MAP, CODECS } from '@/shared/lib/codecs';
import { useDebounce } from '@/shared/hooks/useDebounce';

// Built from real codecs so the samples always decode: Base64(Hex(ROT13(…))) and Base64(Base64(…)).
const SAMPLE = CODEC_MAP.base64.encode(CODEC_MAP.hex.encode(CODEC_MAP.rot13.encode('flag{magic_peels_every_layer}')));
const START = CODEC_MAP.base64.encode(CODEC_MAP.base64.encode('Hello from the Magic Decoder!'));

export default function MagicDecoder() {
  const [input, setInput] = useState(START);
  const [depth, setDepth] = useState(5);
  const debounced = useDebounce(input, 250);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!debounced.trim()) { setResults([]); return; }
    setBusy(true);
    const t = setTimeout(() => {
      try { setResults(magicDecode(debounced, { depth })); } finally { setBusy(false); }
    }, 0);
    return () => clearTimeout(t);
  }, [debounced, depth]);

  const best = results[0];
  const testable = useMemo(() => CODECS.filter((c) => c.test).length, []);

  return (
    <Stack gap="md">
      <Alert variant="light" color="violet" icon={<IconWand size={16} />} p="sm">
        Paste anything encoded — even several layers deep (e.g. Base64 → Hex → ROT13). Magic tries {testable} format detectors recursively
        and ranks the chains whose output looks most like real text.
      </Alert>
      <InputArea label="Encoded input" value={input} onChange={setInput} minRows={4} maxRows={10}
        actions={<Button size="compact-xs" variant="subtle" onClick={() => setInput(SAMPLE)}>Sample</Button>} />
      <Group gap="md" align="center">
        <Text size="sm" fw={500}>Max depth</Text>
        <Slider value={depth} onChange={setDepth} min={1} max={8} step={1} marks={[{ value: 1, label: '1' }, { value: 4, label: '4' }, { value: 8, label: '8' }]} w={260} mb="md" />
        {busy && <Badge variant="light">Searching…</Badge>}
      </Group>

      {!results.length && debounced.trim() && !busy && (
        <Alert color="gray" icon={<IconInfoCircle size={16} />}>
          No readable decoding found. Try the Encoder Hub (decode mode) to see every format side by side, or Cipher Lab for keyed ciphers like XOR / Vigenère.
        </Alert>
      )}

      {results.map((r, i) => (
        <Paper key={i} p="sm" withBorder={i === 0} style={i === 0 ? { borderColor: 'var(--mantine-color-teal-6)' } : undefined}>
          <Group justify="space-between" mb={6} wrap="nowrap">
            <Group gap={4}>
              {i === 0 && <Badge color="teal" variant="filled" size="sm">Best match</Badge>}
              {r.chain.map((id, j) => (
                <Group key={j} gap={4} wrap="nowrap">
                  {j > 0 && <IconArrowRight size={12} />}
                  <Badge variant="light" size="sm">{CODEC_MAP[id]?.label || id}</Badge>
                </Group>
              ))}
            </Group>
            <Group gap={4} wrap="nowrap">
              <Text size="xs" c="dimmed">score {r.score.toFixed(2)}</Text>
              <CopyButton value={r.output} icon />
            </Group>
          </Group>
          <Textarea value={r.output} readOnly autosize minRows={1} maxRows={i === 0 ? 10 : 4} className="code-font" spellCheck={false} />
        </Paper>
      ))}
      {best && <PrivacyNote>Decoding runs entirely in your browser.</PrivacyNote>}
    </Stack>
  );
}
