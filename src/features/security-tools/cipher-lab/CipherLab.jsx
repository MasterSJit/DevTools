import { useMemo, useState } from 'react';
import {
  Stack, Group, Button, Text, Textarea, Tabs, ActionIcon, TextInput, Select, Badge, Switch, Table, SimpleGrid,
  ScrollArea, SegmentedControl, Alert, Tooltip, NumberInput,
} from '@mantine/core';
import { IconArrowUp, IconArrowDown, IconX, IconPlus, IconFlask, IconTrash, IconSearch } from '@tabler/icons-react';
import CopyButton from '@/shared/components/CopyButton';
import { Panel, PrivacyNote } from '@/shared/components/ui';
import { tryUtf8, bytesToHex, hexdump, hexToBytes, utf8Encode, base64ToBytes } from '@/shared/lib/encoding';
import { OPERATIONS, OP_GROUPS, defaultArgs, runRecipe, caesarAll, singleByteXorAll } from './operations';

const PRESETS = [
  { label: 'Decode Base64 → Hex', steps: ['from-base64', 'to-hex'] },
  { label: 'ROT13', steps: ['rot13'] },
  { label: 'Hex → text', steps: ['from-hex'] },
  { label: 'Double Base64 decode', steps: ['from-base64', 'from-base64'] },
  { label: 'URL decode → Base64 decode', steps: ['url-decode', 'from-base64'] },
];

function StepArgs({ step, onChange }) {
  const op = OPERATIONS[step.op];
  if (!op.args) return null;
  return (
    <Group gap="xs" mt={6}>
      {op.args.map((a) => a.options ? (
        <Select key={a.name} size="xs" w={100} data={a.options} value={step.args[a.name]} allowDeselect={false}
          onChange={(v) => onChange({ ...step.args, [a.name]: v })} aria-label={a.label} />
      ) : a.type === 'number' ? (
        <NumberInput key={a.name} size="xs" w={90} value={step.args[a.name]} onChange={(v) => onChange({ ...step.args, [a.name]: v })} aria-label={a.label} />
      ) : (
        <TextInput key={a.name} size="xs" w={140} placeholder={a.label} value={step.args[a.name]}
          onChange={(e) => onChange({ ...step.args, [a.name]: e.currentTarget.value })} aria-label={a.label} />
      ))}
    </Group>
  );
}

function Recipe() {
  const [input, setInput] = useState('Hello, DevForge!');
  const [steps, setSteps] = useState([{ op: 'to-base64', args: {} }, { op: 'rot13', args: {} }]);
  const [filter, setFilter] = useState('');
  const [view, setView] = useState('auto');

  const result = useMemo(() => runRecipe(input, steps), [input, steps]);
  const text = result.data ? tryUtf8(result.data) : null;
  const display = view === 'hex' || (view === 'auto' && text === null) ? hexdump(result.data || new Uint8Array()) : (text ?? '');

  const add = (op) => setSteps((s) => [...s, { op, args: defaultArgs(op) }]);
  const update = (i, patch) => setSteps((s) => s.map((st, j) => (j === i ? { ...st, ...patch } : st)));
  const move = (i, d) => setSteps((s) => { const a = [...s]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); return a; });

  const ops = Object.entries(OPERATIONS).filter(([, o]) => o.label.toLowerCase().includes(filter.toLowerCase()));

  return (
    <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
      <Panel title="Operations" p="sm">
        <TextInput size="xs" placeholder="Search operations…" leftSection={<IconSearch size={12} />} value={filter} onChange={(e) => setFilter(e.currentTarget.value)} mb="xs" />
        <ScrollArea.Autosize mah={460}>
          {OP_GROUPS.map((g) => {
            const list = ops.filter(([, o]) => o.group === g);
            if (!list.length) return null;
            return (
              <div key={g} className="mb-2">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>{g}</Text>
                <Group gap={4}>
                  {list.map(([id, o]) => (
                    <Button key={id} size="compact-xs" variant="light" leftSection={<IconPlus size={10} />} onClick={() => add(id)}>{o.label}</Button>
                  ))}
                </Group>
              </div>
            );
          })}
        </ScrollArea.Autosize>
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt="sm" mb={4}>Presets</Text>
        <Group gap={4}>
          {PRESETS.map((p) => (
            <Button key={p.label} size="compact-xs" variant="default"
              onClick={() => setSteps(p.steps.map((op) => ({ op, args: defaultArgs(op) })))}>{p.label}</Button>
          ))}
        </Group>
      </Panel>

      <Panel title={`Recipe (${steps.length} steps)`} icon={IconFlask} p="sm"
        actions={<Button size="compact-xs" variant="subtle" color="red" leftSection={<IconTrash size={12} />} onClick={() => setSteps([])}>Clear</Button>}>
        <Stack gap={6}>
          {steps.length === 0 && <Text size="sm" c="dimmed">Click operations on the left to build a recipe. Steps run top to bottom.</Text>}
          {steps.map((st, i) => (
            <div key={i} className={`rounded-lg border px-2 py-1.5 ${result.failedAt === i ? 'border-red-400 bg-red-500/5' : 'border-slate-200 dark:border-slate-700'} ${st.disabled ? 'opacity-50' : ''}`}>
              <Group justify="space-between" wrap="nowrap" gap={4}>
                <Group gap={6} wrap="nowrap">
                  <Badge size="xs" variant="filled" circle>{i + 1}</Badge>
                  <Text size="sm" fw={600}>{OPERATIONS[st.op].label}</Text>
                </Group>
                <Group gap={2} wrap="nowrap">
                  <Tooltip label={st.disabled ? 'Enable' : 'Disable'}><Switch size="xs" checked={!st.disabled} onChange={() => update(i, { disabled: !st.disabled })} /></Tooltip>
                  <ActionIcon size="sm" variant="subtle" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><IconArrowUp size={12} /></ActionIcon>
                  <ActionIcon size="sm" variant="subtle" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><IconArrowDown size={12} /></ActionIcon>
                  <ActionIcon size="sm" variant="subtle" color="red" onClick={() => setSteps((s) => s.filter((_, j) => j !== i))} aria-label="Remove"><IconX size={12} /></ActionIcon>
                </Group>
              </Group>
              <StepArgs step={st} onChange={(args) => update(i, { args })} />
              {result.failedAt === i && <Text size="xs" c="red" mt={4}>{result.error}</Text>}
            </div>
          ))}
        </Stack>
      </Panel>

      <Stack gap="md">
        <Panel title="Input" p="sm" actions={<Text size="xs" c="dimmed">{input.length} chars</Text>}>
          <Textarea value={input} onChange={(e) => setInput(e.currentTarget.value)} autosize minRows={6} maxRows={12} className="code-font" spellCheck={false} />
        </Panel>
        <Panel title="Output" p="sm" actions={<>
          <SegmentedControl size="xs" value={view} onChange={setView} data={[{ value: 'auto', label: 'Auto' }, { value: 'text', label: 'Text' }, { value: 'hex', label: 'Hex' }]} />
          <CopyButton value={display} icon />
        </>}>
          {result.error && <Alert color="red" p="xs" mb="xs">Step {result.failedAt + 1} failed — showing data before it.</Alert>}
          {view === 'auto' && text === null && <Text size="xs" c="orange" mb={4}>Output is binary (not valid UTF-8) — showing hexdump.</Text>}
          <Textarea value={display} readOnly autosize minRows={6} maxRows={14} className="code-font" />
          <Text size="xs" c="dimmed" mt={4}>{result.data?.length ?? 0} bytes</Text>
        </Panel>
      </Stack>
    </SimpleGrid>
  );
}

function BruteForce() {
  const [mode, setMode] = useState('caesar');
  const [input, setInput] = useState('Wkh txlfn eurzq ira mxpsv ryhu wkh odcb grj');
  const [fmt, setFmt] = useState('hex');

  const results = useMemo(() => {
    if (!input.trim()) return { rows: [] };
    try {
      if (mode === 'caesar') return { rows: caesarAll(input).sort((a, b) => b.score - a.score) };
      const bytes = fmt === 'hex' ? hexToBytes(input) : fmt === 'base64' ? base64ToBytes(input) : utf8Encode(input);
      return { rows: singleByteXorAll(bytes).slice(0, 20) };
    } catch (e) { return { rows: [], error: e.message }; }
  }, [input, mode, fmt]);

  const best = results.rows[0];

  return (
    <Stack gap="md">
      <Group>
        <SegmentedControl value={mode} onChange={(m) => { setMode(m); setInput(m === 'caesar' ? 'Wkh txlfn eurzq ira mxpsv ryhu wkh odcb grj' : '1b37373331363f78151b7f2b783431333d78397828372d363c78373e783a393b3736'); }}
          data={[{ value: 'caesar', label: 'Caesar / ROT (all 26 shifts)' }, { value: 'xor', label: 'Single-byte XOR (all 256 keys)' }]} />
        {mode === 'xor' && <SegmentedControl size="xs" value={fmt} onChange={setFmt} data={['hex', 'base64', 'text']} />}
      </Group>
      <Textarea label="Ciphertext" value={input} onChange={(e) => setInput(e.currentTarget.value)} autosize minRows={3} className="code-font" />
      {results.error && <Alert color="red" p="xs">{results.error}</Alert>}
      {best && (
        <Alert color="teal" title={`Most likely: ${mode === 'caesar' ? `shift ${best.shift} (ROT${(26 - best.shift) % 26})` : `key 0x${best.key.toString(16).padStart(2, '0')} ('${String.fromCharCode(best.key)}')`}`}>
          <Text ff="monospace" size="sm" style={{ wordBreak: 'break-all' }}>{best.out}</Text>
        </Alert>
      )}
      <Panel title="Candidates ranked by English-likeness" p="sm">
        <ScrollArea.Autosize mah={420}>
          <Table striped verticalSpacing={4}>
            <Table.Tbody>
              {results.rows.map((r) => (
                <Table.Tr key={mode === 'caesar' ? r.shift : r.key}>
                  <Table.Td w={90}><Badge variant="light" size="sm">{mode === 'caesar' ? `−${r.shift}` : `0x${r.key.toString(16).padStart(2, '0')}`}</Badge></Table.Td>
                  <Table.Td><Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>{r.out.replace(/[\x00-\x08\x0e-\x1f\x7f-\xff]/g, '·')}</Text></Table.Td>
                  <Table.Td w={60}><Text size="xs" c="dimmed">{r.score.toFixed(1)}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      </Panel>
    </Stack>
  );
}

export default function CipherLab() {
  const [tab, setTab] = useState('recipe');
  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="recipe">Recipe chain</Tabs.Tab>
          <Tabs.Tab value="brute">Brute-force helpers</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'recipe' ? <Recipe /> : <BruteForce />}
      <PrivacyNote>Useful for CTFs and decoding obfuscated data. Classic ciphers are not secure encryption — use Encrypt / Decrypt for real secrets.</PrivacyNote>
    </Stack>
  );
}
