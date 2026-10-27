import { useMemo, useState } from 'react';
import { Tabs, Stack, Group, SegmentedControl, SimpleGrid, Alert, Table, TextInput, ActionIcon, Button, Text, Badge } from '@mantine/core';
import { IconPlus, IconX, IconLink } from '@tabler/icons-react';
import CopyButton from '@/shared/components/CopyButton';
import { InputArea, OutputArea, Panel, KVTable } from '@/shared/components/ui';

const ENCODERS = {
  component: { label: 'Component (encodeURIComponent)', enc: encodeURIComponent, dec: decodeURIComponent },
  uri: { label: 'Full URL (encodeURI)', enc: encodeURI, dec: decodeURI },
  form: { label: 'Form (application/x-www-form-urlencoded)', enc: (s) => encodeURIComponent(s).replace(/%20/g, '+'), dec: (s) => decodeURIComponent(s.replace(/\+/g, ' ')) },
  all: { label: 'Encode every character', enc: (s) => Array.from(new TextEncoder().encode(s), (b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join(''), dec: decodeURIComponent },
};

function EncodeDecode() {
  const [mode, setMode] = useState('encode');
  const [kind, setKind] = useState('component');
  const [input, setInput] = useState('https://example.com/search?q=hello world&lang=हिन्दी');

  const result = useMemo(() => {
    try { return { value: input ? ENCODERS[kind][mode === 'encode' ? 'enc' : 'dec'](input) : '' }; }
    catch (e) { return { error: `${e.message} — the input contains an invalid % escape sequence.` }; }
  }, [input, mode, kind]);

  return (
    <Stack gap="md">
      <Group>
        <SegmentedControl value={mode} onChange={setMode} data={[{ value: 'encode', label: 'Encode' }, { value: 'decode', label: 'Decode' }]} />
        <SegmentedControl size="xs" value={kind} onChange={setKind} data={Object.entries(ENCODERS).map(([value, e]) => ({ value, label: e.label.split(' (')[0] }))} />
        <Button size="xs" variant="light" disabled={!result.value} onClick={() => { setInput(result.value); setMode(mode === 'encode' ? 'decode' : 'encode'); }}>Swap</Button>
      </Group>
      <Text size="xs" c="dimmed">{ENCODERS[kind].label}</Text>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <InputArea value={input} onChange={setInput} minRows={6} />
        <OutputArea value={result.value || ''} minRows={6} />
      </SimpleGrid>
      {result.error && <Alert color="red" p="xs">{result.error}</Alert>}
    </Stack>
  );
}

function Parser() {
  const [url, setUrl] = useState('https://user:pass@api.example.com:8443/v1/items/42?sort=desc&tags=a&tags=b&q=%E2%9C%93#section-2');
  const parsed = useMemo(() => { try { return new URL(url.trim()); } catch { return null; } }, [url]);
  const [params, setParams] = useState(null);

  const rows = params ?? (parsed ? [...parsed.searchParams] : []);
  const rebuilt = useMemo(() => {
    if (!parsed) return '';
    const u = new URL(parsed.href);
    u.search = '';
    rows.forEach(([k, v]) => k && u.searchParams.append(k, v));
    return u.href;
  }, [parsed, rows]);

  const update = (i, idx, v) => setParams(rows.map((r, j) => (j === i ? (idx === 0 ? [v, r[1]] : [r[0], v]) : r)));

  return (
    <Stack gap="md">
      <TextInput size="md" value={url} onChange={(e) => { setUrl(e.currentTarget.value); setParams(null); }} leftSection={<IconLink size={16} />} className="code-font" />
      {!parsed && url && <Alert color="red" p="xs">Not a valid absolute URL (include the scheme, e.g. https://).</Alert>}
      {parsed && (
        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          <Panel title="Components">
            <KVTable labelWidth={110} rows={[
              ['Protocol', parsed.protocol],
              parsed.username && ['Username', decodeURIComponent(parsed.username)],
              parsed.password && ['Password', decodeURIComponent(parsed.password), { color: 'red' }],
              ['Host', parsed.hostname],
              ['Port', parsed.port || `(default ${parsed.protocol === 'https:' ? 443 : parsed.protocol === 'http:' ? 80 : '—'})`],
              ['Origin', parsed.origin],
              ['Path', decodeURIComponent(parsed.pathname)],
              ['Query', parsed.search],
              ['Fragment', parsed.hash],
            ]} />
          </Panel>
          <Panel title={`Query parameters (${rows.length})`} actions={<Button size="compact-xs" variant="subtle" leftSection={<IconPlus size={12} />} onClick={() => setParams([...rows, ['', '']])}>Add</Button>}>
            <Table verticalSpacing={4}>
              <Table.Tbody>
                {rows.map(([k, v], i) => (
                  <Table.Tr key={i}>
                    <Table.Td><TextInput size="xs" value={k} onChange={(e) => update(i, 0, e.currentTarget.value)} /></Table.Td>
                    <Table.Td><TextInput size="xs" value={v} onChange={(e) => update(i, 1, e.currentTarget.value)} /></Table.Td>
                    <Table.Td w={36}><ActionIcon size="sm" variant="subtle" color="red" onClick={() => setParams(rows.filter((_, j) => j !== i))}><IconX size={12} /></ActionIcon></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group mt="sm" wrap="nowrap" gap="xs">
              <Badge variant="light" style={{ flexShrink: 0 }}>Rebuilt</Badge>
              <Text size="xs" ff="monospace" style={{ wordBreak: 'break-all', flex: 1 }}>{rebuilt}</Text>
              <CopyButton value={rebuilt} icon />
            </Group>
          </Panel>
        </SimpleGrid>
      )}
    </Stack>
  );
}

export default function UrlEncoder() {
  const [tab, setTab] = useState('codec');
  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="codec">Encode / Decode</Tabs.Tab>
          <Tabs.Tab value="parse">URL Parser &amp; Query Editor</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'codec' ? <EncodeDecode /> : <Parser />}
    </Stack>
  );
}
