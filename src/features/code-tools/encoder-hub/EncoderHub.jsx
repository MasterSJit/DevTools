import { useMemo, useState } from 'react';
import {
  Stack, Group, SegmentedControl, TextInput, Text, SimpleGrid, Paper, Badge, Chip, Textarea, Button,
} from '@mantine/core';
import { IconSearch, IconArrowBackUp } from '@tabler/icons-react';
import { InputArea, PrivacyNote } from '@/shared/components/ui';
import CopyButton from '@/shared/components/CopyButton';
import { CODECS, CODEC_GROUPS } from '@/shared/lib/codecs';

export default function EncoderHub() {
  const [input, setInput] = useState('Hello, DevForge! 🔐');
  const [dir, setDir] = useState('encode');
  const [groups, setGroups] = useState(CODEC_GROUPS);
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CODECS
      .filter((c) => groups.includes(c.group) && (!needle || c.label.toLowerCase().includes(needle) || c.id.includes(needle)))
      .map((c) => {
        if (!input) return { c, value: '' };
        try { return { c, value: c[dir](dir === 'decode' ? input.trim() : input) }; } catch (e) { return { c, error: e.message }; }
      });
  }, [input, dir, groups, q]);

  const okCount = results.filter((r) => r.value && !r.error).length;

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Group>
          <SegmentedControl value={dir} onChange={setDir} data={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />
          <TextInput placeholder="Filter encodings…" leftSection={<IconSearch size={14} />} value={q} onChange={(e) => setQ(e.currentTarget.value)} w={220} />
        </Group>
        <Badge variant="light" size="lg">{okCount} / {results.length} {dir === 'encode' ? 'encoded' : 'decoded'}</Badge>
      </Group>
      <Chip.Group multiple value={groups} onChange={(v) => setGroups(v.length ? v : CODEC_GROUPS)}>
        <Group gap={6}>{CODEC_GROUPS.map((g) => <Chip key={g} value={g} size="xs" variant="light">{g}</Chip>)}</Group>
      </Chip.Group>
      <InputArea label={dir === 'encode' ? 'Plain text' : 'Encoded text'} value={input} onChange={setInput} minRows={4} maxRows={10} />
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
        {results.map(({ c, value, error }) => (
          <Paper key={c.id} p="xs" style={{ opacity: error ? 0.55 : 1 }}>
            <Group justify="space-between" mb={4} wrap="nowrap">
              <Group gap={6} wrap="nowrap">
                <Text size="sm" fw={600}>{c.label}</Text>
                <Badge size="xs" variant="dot" color="gray">{c.group}</Badge>
              </Group>
              <Group gap={2} wrap="nowrap">
                {value && (
                  <Button size="compact-xs" variant="subtle" leftSection={<IconArrowBackUp size={12} />}
                    onClick={() => { setInput(value); setDir(dir === 'encode' ? 'decode' : 'encode'); setQ(c.label); }}>
                    Use
                  </Button>
                )}
                <CopyButton value={value || ''} icon />
              </Group>
            </Group>
            {error
              ? <Text size="xs" c="red">{error}</Text>
              : <Textarea value={value} readOnly autosize minRows={1} maxRows={5} className="code-font" size="xs" spellCheck={false} />}
          </Paper>
        ))}
      </SimpleGrid>
      <PrivacyNote>
        {CODECS.length} encodings, all computed locally as you type. “Use” sends a result back to the input and flips direction so you can round-trip it.
      </PrivacyNote>
    </Stack>
  );
}
