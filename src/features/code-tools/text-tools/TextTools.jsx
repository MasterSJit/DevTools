import { useMemo, useState } from 'react';
import { Stack, Group, Button, Text, SimpleGrid, Badge, Divider } from '@mantine/core';
import { IconArrowsExchange } from '@tabler/icons-react';
import { InputArea, OutputArea, Panel, Stat } from '@/shared/components/ui';
import { shuffle } from '@/shared/lib/crypto';

const words = (s) => s
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  .split(/[^A-Za-z0-9]+/)
  .filter(Boolean);

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

const CASES = {
  UPPERCASE: (s) => s.toUpperCase(),
  lowercase: (s) => s.toLowerCase(),
  'Title Case': (s) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()),
  'Sentence case': (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, p, c) => p + c.toUpperCase()),
  camelCase: (s) => s.split('\n').map((l) => words(l).map((w, i) => (i ? cap(w) : w.toLowerCase())).join('')).join('\n'),
  PascalCase: (s) => s.split('\n').map((l) => words(l).map(cap).join('')).join('\n'),
  snake_case: (s) => s.split('\n').map((l) => words(l).map((w) => w.toLowerCase()).join('_')).join('\n'),
  'kebab-case': (s) => s.split('\n').map((l) => words(l).map((w) => w.toLowerCase()).join('-')).join('\n'),
  CONSTANT_CASE: (s) => s.split('\n').map((l) => words(l).map((w) => w.toUpperCase()).join('_')).join('\n'),
  'dot.case': (s) => s.split('\n').map((l) => words(l).map((w) => w.toLowerCase()).join('.')).join('\n'),
  slugify: (s) => s.split('\n').map((l) => l.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')).join('\n'),
  'iNVERT cASE': (s) => s.replace(/\p{L}/gu, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())),
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const LINES = {
  'Sort A→Z': (l) => [...l].sort(collator.compare),
  'Sort Z→A': (l) => [...l].sort(collator.compare).reverse(),
  'Sort by length': (l) => [...l].sort((a, b) => a.length - b.length),
  Reverse: (l) => [...l].reverse(),
  Shuffle: (l) => shuffle(l),
  'Remove duplicates': (l) => [...new Set(l)],
  'Remove empty lines': (l) => l.filter((x) => x.trim()),
  'Trim lines': (l) => l.map((x) => x.trim()),
  'Number lines': (l) => l.map((x, i) => `${i + 1}. ${x}`),
  'Join with comma': (l) => [l.filter((x) => x.trim()).join(', ')],
  'Split by comma': (l) => l.join(',').split(',').map((x) => x.trim()),
};

const OTHER = {
  'Collapse whitespace': (s) => s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n'),
  'Remove line breaks': (s) => s.replace(/\s*\n\s*/g, ' '),
  'Strip HTML tags': (s) => s.replace(/<[^>]*>/g, ''),
  'Remove accents': (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, ''),
  'Reverse text': (s) => Array.from(s).reverse().join(''),
};

function stats(s) {
  const w = s.match(/\S+/g) || [];
  const freq = {};
  for (const x of w) { const k = x.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, ''); if (k.length > 3) freq[k] = (freq[k] || 0) + 1; }
  return {
    chars: [...s].length,
    noSpaces: [...s.replace(/\s/g, '')].length,
    words: w.length,
    lines: s ? s.split('\n').length : 0,
    sentences: (s.match(/[^.!?]+[.!?]+/g) || []).length,
    paragraphs: s.split(/\n\s*\n/).filter((p) => p.trim()).length,
    bytes: new TextEncoder().encode(s).length,
    reading: Math.max(1, Math.round(w.length / 230)),
    top: Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8),
  };
}

export default function TextTools() {
  const [input, setInput] = useState('The quick brown Fox jumps over the lazy dog.\nhello world from DevForge\nuserProfileSettings\nhello world from DevForge');
  const [output, setOutput] = useState('');
  const [last, setLast] = useState('');
  const st = useMemo(() => stats(input), [input]);

  const apply = (name, fn, lineMode) => {
    setLast(name);
    setOutput(lineMode ? fn(input.split('\n')).join('\n') : fn(input));
  };

  const btns = (map, lineMode) => Object.entries(map).map(([name, fn]) => (
    <Button key={name} size="compact-sm" variant={last === name ? 'filled' : 'default'} onClick={() => apply(name, fn, lineMode)}>{name}</Button>
  ));

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 4, lg: 8 }} spacing="xs">
        <Stat label="Characters" value={st.chars.toLocaleString()} />
        <Stat label="No spaces" value={st.noSpaces.toLocaleString()} />
        <Stat label="Words" value={st.words.toLocaleString()} />
        <Stat label="Lines" value={st.lines.toLocaleString()} />
        <Stat label="Sentences" value={st.sentences.toLocaleString()} />
        <Stat label="Paragraphs" value={st.paragraphs.toLocaleString()} />
        <Stat label="UTF-8 bytes" value={st.bytes.toLocaleString()} />
        <Stat label="Reading time" value={`${st.reading} min`} />
      </SimpleGrid>

      <Panel p="sm">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={6}>Case</Text>
        <Group gap={6}>{btns(CASES, false)}</Group>
        <Divider my="sm" />
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={6}>Lines</Text>
        <Group gap={6}>{btns(LINES, true)}</Group>
        <Divider my="sm" />
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={6}>Clean up</Text>
        <Group gap={6}>{btns(OTHER, false)}</Group>
      </Panel>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <InputArea value={input} onChange={setInput} minRows={10} />
        <OutputArea value={output} label={last ? `Output — ${last}` : 'Output'} minRows={10}
          actions={<Button size="compact-xs" variant="subtle" leftSection={<IconArrowsExchange size={12} />} disabled={!output} onClick={() => setInput(output)}>Use as input</Button>} />
      </SimpleGrid>

      {st.top.length > 0 && (
        <Panel title="Most frequent words (4+ letters)" p="sm">
          <Group gap={6}>{st.top.map(([w, n]) => <Badge key={w} variant="light" tt="none">{w} × {n}</Badge>)}</Group>
        </Panel>
      )}
    </Stack>
  );
}
