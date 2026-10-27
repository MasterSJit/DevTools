import { useState, useCallback, useEffect } from 'react';
import { Stack, Group, Button, NumberInput, Select, Paper, Text, Textarea, Switch, SegmentedControl, Modal, ActionIcon, Tooltip, Badge } from '@mantine/core';
import { IconRefresh, IconMaximize, IconMinimize } from '@tabler/icons-react';
import { LoremIpsum } from 'lorem-ipsum';
import CopyButton from '@/shared/components/CopyButton';
import DownloadButton from '@/shared/components/DownloadButton';

const lorem = new LoremIpsum({ sentencesPerParagraph: { min: 4, max: 8 }, wordsPerSentence: { min: 6, max: 16 } });
const CLASSIC = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

function build(type, count, { classic, format }) {
  let parts;
  if (type === 'paragraphs') parts = Array.from({ length: count }, () => lorem.generateParagraphs(1));
  else if (type === 'sentences') parts = [lorem.generateSentences(count)];
  else if (type === 'words') parts = [lorem.generateWords(count)];
  else parts = Array.from({ length: count }, () => lorem.generateSentences(1).replace(/\.$/, ''));
  if (classic && parts.length && type !== 'words') parts[0] = `${CLASSIC}${type === 'list' ? '' : '. '}${type === 'list' ? '' : parts[0].charAt(0).toUpperCase() + parts[0].slice(1)}`.trim();
  if (format === 'html') {
    if (type === 'list') return `<ul>\n${parts.map((p) => `  <li>${p}</li>`).join('\n')}\n</ul>`;
    return parts.map((p) => `<p>${p}</p>`).join('\n\n');
  }
  if (format === 'markdown' && type === 'list') return parts.map((p) => `- ${p}`).join('\n');
  return type === 'list' ? parts.join('\n') : parts.join('\n\n');
}

export default function LoremGenerator() {
  const [count, setCount] = useState(5);
  const [type, setType] = useState('paragraphs');
  const [format, setFormat] = useState('text');
  const [classic, setClassic] = useState(true);
  const [output, setOutput] = useState('');
  const [full, setFull] = useState(false);

  const generate = useCallback(() => setOutput(build(type, count, { classic, format })), [type, count, classic, format]);
  useEffect(() => { generate(); }, [generate]);

  const words = (output.match(/\S+/g) || []).length;
  const actions = (
    <Group gap={6}>
      <Badge variant="light" color="gray">{words} words · {output.length} chars</Badge>
      <CopyButton value={output} icon />
      <DownloadButton data={output} filename={format === 'html' ? 'lorem.html' : format === 'markdown' ? 'lorem.md' : 'lorem.txt'} variant="subtle" size="compact-xs" />
      <Tooltip label={full ? 'Exit fullscreen' : 'Fullscreen'}>
        <ActionIcon variant="subtle" onClick={() => setFull((f) => !f)} aria-label="Toggle fullscreen">{full ? <IconMinimize size={16} /> : <IconMaximize size={16} />}</ActionIcon>
      </Tooltip>
    </Group>
  );

  return (
    <Stack gap="md">
      <Paper p="sm">
        <Group align="flex-end" wrap="wrap">
          <NumberInput label="Count" value={count} onChange={(v) => setCount(Math.max(1, Math.min(500, Number(v) || 1)))} min={1} max={500} w={100} />
          <Select label="Type" value={type} onChange={setType} allowDeselect={false} w={150}
            data={[{ value: 'paragraphs', label: 'Paragraphs' }, { value: 'sentences', label: 'Sentences' }, { value: 'words', label: 'Words' }, { value: 'list', label: 'List items' }]} />
          <SegmentedControl value={format} onChange={setFormat} data={[{ value: 'text', label: 'Plain' }, { value: 'html', label: 'HTML' }, { value: 'markdown', label: 'Markdown' }]} />
          <Switch label="Start with “Lorem ipsum…”" checked={classic} onChange={(e) => setClassic(e.currentTarget.checked)} mb={8} />
          <Button leftSection={<IconRefresh size={16} />} onClick={generate}>Regenerate</Button>
        </Group>
      </Paper>

      <Paper p="sm">
        <Group justify="space-between" mb="xs">
          <Text fw={600} size="sm">Output</Text>
          {actions}
        </Group>
        <Textarea value={output} readOnly autosize minRows={18} maxRows={40}
          styles={{ input: { fontSize: 15, lineHeight: 1.75, fontFamily: format === 'text' ? undefined : 'var(--mantine-font-family-monospace)' } }} />
      </Paper>

      <Modal opened={full} onClose={() => setFull(false)} fullScreen title={<Group gap="sm"><Text fw={600}>Lorem Ipsum</Text>{actions}</Group>}>
        <Textarea value={output} readOnly autosize minRows={30}
          styles={{ input: { fontSize: 17, lineHeight: 1.85, border: 'none', fontFamily: format === 'text' ? undefined : 'var(--mantine-font-family-monospace)' } }} />
      </Modal>
    </Stack>
  );
}
