import { useEffect, useRef, useState } from 'react';
import {
  Stack, Group, Text, TextInput, Textarea, Chip, Badge, Table, SimpleGrid, Alert, ScrollArea, Button, Code, Tabs,
} from '@mantine/core';
import { IconRegex, IconAlertTriangle } from '@tabler/icons-react';
import CopyButton from '@/shared/components/CopyButton';
import { Panel } from '@/shared/components/ui';
import { useDebounce } from '@/shared/hooks/useDebounce';

const FLAGS = [
  ['g', 'global'], ['i', 'ignore case'], ['m', 'multiline'], ['s', 'dotAll'], ['u', 'unicode'], ['y', 'sticky'],
];

const PRESETS = [
  ['Email', String.raw`[\w.+-]+@[\w-]+\.[\w.-]+`],
  ['URL', String.raw`https?:\/\/[^\s/$.?#].[^\s]*`],
  ['IPv4', String.raw`\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b`],
  ['UUID', String.raw`[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}`],
  ['Hex color', String.raw`#(?:[0-9a-fA-F]{3}){1,2}\b`],
  ['ISO date', String.raw`(?<year>\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\d|3[01])`],
  ['JWT', String.raw`eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+`],
  ['Semver', String.raw`\bv?(\d+)\.(\d+)\.(\d+)(?:-[\w.]+)?\b`],
];

const SAMPLE = `Contact: alice@example.com, bob.smith+dev@mail.co.uk
Visit https://devforge.dev/tools?id=42 on 2026-10-27
Server 192.168.1.20 → 10.0.0.256 (invalid)
Colors: #fff #8B5CF6 #12345g`;

// Runs the regex in a throw-away worker so catastrophic backtracking (ReDoS) can't freeze the page.
const WORKER_SRC = `
self.onmessage = (e) => {
  const { pattern, flags, text, replacement } = e.data;
  try {
    const re = new RegExp(pattern, flags);
    const matches = [];
    if (re.global || re.sticky) {
      let m, guard = 0;
      while ((m = re.exec(text)) && guard++ < 10000) {
        matches.push({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups || null });
        if (m[0] === '') re.lastIndex++;
        if (!re.global) break;
      }
    } else {
      const m = re.exec(text);
      if (m) matches.push({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups || null });
    }
    let replaced = null;
    if (replacement !== null) replaced = text.replace(new RegExp(pattern, flags), replacement);
    self.postMessage({ matches, replaced });
  } catch (err) {
    self.postMessage({ error: err.message });
  }
};`;

function useRegexWorker(pattern, flags, text, replacement) {
  const [state, setState] = useState({ matches: [] });
  const urlRef = useRef(null);

  useEffect(() => {
    if (!urlRef.current) urlRef.current = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    return () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = null; };
  }, []);

  useEffect(() => {
    if (!pattern) { setState({ matches: [] }); return; }
    if (!urlRef.current) urlRef.current = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    const worker = new Worker(urlRef.current);
    const started = performance.now();
    const timer = setTimeout(() => {
      worker.terminate();
      setState({ matches: [], timeout: true });
    }, 1500);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      setState({ ...e.data, ms: Math.round(performance.now() - started) });
    };
    worker.postMessage({ pattern, flags, text, replacement });
    return () => { clearTimeout(timer); worker.terminate(); };
  }, [pattern, flags, text, replacement]);

  return state;
}

function Highlighted({ text, matches }) {
  const parts = [];
  let last = 0;
  matches.forEach((m, i) => {
    if (m.index > last) parts.push(<span key={`t${i}`}>{text.slice(last, m.index)}</span>);
    parts.push(<mark key={`m${i}`} className={i % 2 ? 'df-match-alt' : 'df-match'} style={{ color: 'inherit' }}>{m.text || '​'}</mark>);
    last = m.index + m.text.length;
  });
  parts.push(<span key="end">{text.slice(last)}</span>);
  return (
    <pre className="code-font m-0 text-[13px] leading-6 whitespace-pre-wrap break-words">{parts}</pre>
  );
}

export default function RegexTester() {
  const [pattern, setPattern] = useState(PRESETS[0][1]);
  const [flags, setFlags] = useState(['g', 'i']);
  const [text, setText] = useState(SAMPLE);
  const [replacement, setReplacement] = useState('[$&]');
  const [tab, setTab] = useState('matches');

  const flagStr = FLAGS.map(([f]) => f).filter((f) => flags.includes(f)).join('');
  const dText = useDebounce(text, 150);
  const dPattern = useDebounce(pattern, 150);
  const r = useRegexWorker(dPattern, flagStr, dText, tab === 'replace' ? replacement : null);

  const literal = `/${pattern.replace(/\//g, '\\/')}/${flagStr}`;

  return (
    <Stack gap="md">
      <Panel>
        <Group align="flex-end" wrap="nowrap" gap="xs">
          <TextInput
            label="Regular expression"
            value={pattern}
            onChange={(e) => setPattern(e.currentTarget.value)}
            leftSection={<Text c="dimmed" ff="monospace">/</Text>}
            rightSection={<Text c="dimmed" ff="monospace" size="sm">/{flagStr}</Text>}
            rightSectionWidth={60}
            style={{ flex: 1 }}
            className="code-font"
            error={r.error}
            spellCheck={false}
          />
          <CopyButton value={literal} icon />
        </Group>
        <Group mt="sm" gap="xs" justify="space-between">
          <Chip.Group multiple value={flags} onChange={setFlags}>
            <Group gap={6}>
              {FLAGS.map(([f, label]) => <Chip key={f} value={f} size="xs" variant="light">{f} · {label}</Chip>)}
            </Group>
          </Chip.Group>
          <Group gap={4}>
            {PRESETS.map(([name, p]) => (
              <Button key={name} size="compact-xs" variant="default" onClick={() => setPattern(p)}>{name}</Button>
            ))}
          </Group>
        </Group>
      </Panel>

      {r.timeout && (
        <Alert color="red" icon={<IconAlertTriangle />} title="Regex timed out (> 1.5 s)">
          This pattern likely causes catastrophic backtracking (ReDoS). Nested quantifiers like <Code>(a+)+</Code> or
          overlapping alternations like <Code>(a|a)*</Code> are the usual culprits. Running it on user input in production could hang your server.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title="Test string" p="sm">
          <Textarea value={text} onChange={(e) => setText(e.currentTarget.value)} autosize minRows={8} maxRows={20} className="code-font" spellCheck={false} />
        </Panel>
        <Panel title="Highlighted" icon={IconRegex} p="sm" actions={
          <Group gap={6}>
            <Badge variant="light" color={r.matches?.length ? 'teal' : 'gray'}>{r.matches?.length || 0} match{r.matches?.length === 1 ? '' : 'es'}</Badge>
            {r.ms != null && <Badge variant="outline" color="gray">{r.ms} ms</Badge>}
          </Group>
        }>
          <ScrollArea.Autosize mah={420}>
            <Highlighted text={dText} matches={r.error || r.timeout ? [] : r.matches || []} />
          </ScrollArea.Autosize>
        </Panel>
      </SimpleGrid>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="matches">Match details</Tabs.Tab>
          <Tabs.Tab value="replace">Replace</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {tab === 'matches' ? (
        <Panel p="sm">
          {r.matches?.length ? (
            <ScrollArea.Autosize mah={360}>
              <Table striped verticalSpacing={4}>
                <Table.Thead><Table.Tr><Table.Th w={50}>#</Table.Th><Table.Th w={80}>Index</Table.Th><Table.Th>Match</Table.Th><Table.Th>Groups</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {r.matches.map((m, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{i + 1}</Table.Td>
                      <Table.Td><Text size="xs" ff="monospace">{m.index}</Text></Table.Td>
                      <Table.Td><Code>{m.text}</Code></Table.Td>
                      <Table.Td>
                        <Group gap={4}>
                          {m.named
                            ? Object.entries(m.named).map(([k, v]) => <Badge key={k} size="sm" variant="light" tt="none">{k}: {v ?? '∅'}</Badge>)
                            : m.groups.map((g, gi) => <Badge key={gi} size="sm" variant="outline" tt="none">${gi + 1}: {g ?? '∅'}</Badge>)}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          ) : <Text size="sm" c="dimmed">No matches.</Text>}
        </Panel>
      ) : (
        <Panel p="sm">
          <TextInput label="Replacement ($1, $<name>, $& supported)" value={replacement} onChange={(e) => setReplacement(e.currentTarget.value)} className="code-font" mb="sm" />
          <Group justify="space-between" mb={4}><Text size="xs" c="dimmed">Result</Text><CopyButton value={r.replaced || ''} icon /></Group>
          <Textarea value={r.replaced ?? ''} readOnly autosize minRows={4} maxRows={16} className="code-font" />
        </Panel>
      )}
    </Stack>
  );
}
