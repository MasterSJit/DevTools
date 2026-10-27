import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Stack, Group, Button, Paper, Text, Slider, Switch, Tabs, TextInput, PasswordInput, NumberInput,
  Progress, Select, SimpleGrid, Badge, Table, Alert,
} from '@mantine/core';
import { IconRefresh, IconPassword, IconShieldSearch, IconWorldSearch } from '@tabler/icons-react';
import CopyButton from '@/shared/components/CopyButton';
import { Panel, FindingList, PrivacyNote } from '@/shared/components/ui';
import { randomInt, shuffle, digest } from '@/shared/lib/crypto';
import { bytesToHex } from '@/shared/lib/encoding';
import { analyzePassword, SCORE_LABELS, ATTACKS, crackTime } from '@/shared/lib/password';
import { WORDLIST } from './wordlist';

const SETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>/?~',
};
const AMBIGUOUS = /[Il1O0o|`'"]/g;

function generatePassword(len, opts) {
  const pools = Object.keys(SETS)
    .filter((k) => opts[k])
    .map((k) => {
      let chars = k === 'symbols' && opts.customSymbols ? opts.customSymbols : SETS[k];
      if (opts.noAmbiguous) chars = chars.replace(AMBIGUOUS, '');
      return chars;
    })
    .filter(Boolean);
  if (!pools.length) return '';
  const all = pools.join('');
  // Guarantee one char from every selected class, then fill the rest uniformly.
  const chars = pools.map((p) => p[randomInt(p.length)]);
  while (chars.length < len) chars.push(all[randomInt(all.length)]);
  return shuffle(chars).slice(0, len).join('');
}

function generatePassphrase(words, opts) {
  const list = Array.from({ length: words }, () => {
    const w = WORDLIST[randomInt(WORDLIST.length)];
    return opts.capitalize ? w[0].toUpperCase() + w.slice(1) : w;
  });
  if (opts.addNumber) list[randomInt(list.length)] += randomInt(100);
  return list.join(opts.separator);
}

function StrengthMeter({ password }) {
  const a = useMemo(() => analyzePassword(password), [password]);
  const s = SCORE_LABELS[a.score];
  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Group gap="xs">
          <Badge color={s.color} size="lg" variant="light">{s.label}</Badge>
          <Text size="sm" c="dimmed">≈ {Math.round(a.entropy)} bits of entropy</Text>
        </Group>
        <Text size="xs" c="dimmed">{password.length} chars · charset {a.pool || 0}</Text>
      </Group>
      <Progress value={Math.min(100, (a.entropy / 100) * 100)} color={s.color} size="md" radius="xl" />
      <Table withRowBorders={false} verticalSpacing={4}>
        <Table.Tbody>
          {ATTACKS.map((atk) => (
            <Table.Tr key={atk.label}>
              <Table.Td><Text size="xs" c="dimmed">{atk.label}</Text></Table.Td>
              <Table.Td ta="right"><Text size="xs" fw={600}>{crackTime(a.entropy, atk.rate)}</Text></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <FindingList findings={a.findings} />
    </Stack>
  );
}

function Generator() {
  const [mode, setMode] = useState('password');
  const [length, setLength] = useState(20);
  const [words, setWords] = useState(5);
  const [count, setCount] = useState(1);
  const [opts, setOpts] = useState({ upper: true, lower: true, digits: true, symbols: true, noAmbiguous: false, customSymbols: '' });
  const [pp, setPp] = useState({ separator: '-', capitalize: true, addNumber: true });
  const [list, setList] = useState([]);

  const generate = useCallback(() => {
    setList(Array.from({ length: count }, () => {
      if (mode === 'password') return generatePassword(length, opts);
      if (mode === 'pin') return Array.from({ length }, () => randomInt(10)).join('');
      return generatePassphrase(words, pp);
    }));
  }, [mode, length, words, count, opts, pp]);

  useEffect(() => { generate(); }, [generate]);

  const first = list[0] || '';
  const toggle = (k) => setOpts((o) => ({ ...o, [k]: !o[k] }));

  return (
    <Stack gap="md">
      <Paper p="lg" className="text-center">
        <Text ff="monospace" fw={600} style={{ fontSize: first.length > 40 ? 16 : 22, wordBreak: 'break-all' }} mb="sm">
          {first || '—'}
        </Text>
        <Group justify="center" gap="xs">
          <Button leftSection={<IconRefresh size={16} />} onClick={generate}>Regenerate</Button>
          <CopyButton value={first} />
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Panel title="Options">
          <Stack gap="md">
            <Select value={mode} onChange={setMode} label="Type" allowDeselect={false}
              data={[{ value: 'password', label: 'Random password' }, { value: 'passphrase', label: `Passphrase (${WORDLIST.length}-word list)` }, { value: 'pin', label: 'PIN (digits)' }]} />
            {mode !== 'passphrase' ? (
              <div>
                <Text size="sm" mb={4}>Length: <b>{length}</b></Text>
                <Slider value={length} onChange={setLength} min={4} max={128} marks={[{ value: 12 }, { value: 20 }, { value: 32 }, { value: 64 }]} />
              </div>
            ) : (
              <div>
                <Text size="sm" mb={4}>Words: <b>{words}</b></Text>
                <Slider value={words} onChange={setWords} min={3} max={12} />
              </div>
            )}
            {mode === 'password' && (
              <SimpleGrid cols={2} spacing="xs">
                <Switch label="A–Z" checked={opts.upper} onChange={() => toggle('upper')} />
                <Switch label="a–z" checked={opts.lower} onChange={() => toggle('lower')} />
                <Switch label="0–9" checked={opts.digits} onChange={() => toggle('digits')} />
                <Switch label="Symbols" checked={opts.symbols} onChange={() => toggle('symbols')} />
                <Switch label="No ambiguous (Il1O0)" checked={opts.noAmbiguous} onChange={() => toggle('noAmbiguous')} />
              </SimpleGrid>
            )}
            {mode === 'password' && opts.symbols && (
              <TextInput size="xs" label="Custom symbol set (optional)" placeholder={SETS.symbols}
                value={opts.customSymbols} onChange={(e) => setOpts((o) => ({ ...o, customSymbols: e.currentTarget.value }))} />
            )}
            {mode === 'passphrase' && (
              <Group>
                <Select w={140} label="Separator" value={pp.separator} onChange={(v) => setPp((p) => ({ ...p, separator: v }))} allowDeselect={false}
                  data={[{ value: '-', label: 'Hyphen -' }, { value: '_', label: 'Underscore _' }, { value: '.', label: 'Dot .' }, { value: ' ', label: 'Space' }, { value: '', label: 'None' }]} />
                <Switch mt={24} label="Capitalize" checked={pp.capitalize} onChange={(e) => setPp((p) => ({ ...p, capitalize: e.currentTarget.checked }))} />
                <Switch mt={24} label="Add number" checked={pp.addNumber} onChange={(e) => setPp((p) => ({ ...p, addNumber: e.currentTarget.checked }))} />
              </Group>
            )}
            <NumberInput label="How many" value={count} onChange={(v) => setCount(Math.max(1, Math.min(100, Number(v) || 1)))} min={1} max={100} w={140} />
          </Stack>
        </Panel>
        <Panel title="Strength of this password">
          <StrengthMeter password={first} />
        </Panel>
      </SimpleGrid>

      {list.length > 1 && (
        <Panel title={`${list.length} passwords`} actions={<CopyButton value={list.join('\n')} icon />}>
          <Stack gap={4}>
            {list.map((p, i) => (
              <Group key={i} justify="space-between" wrap="nowrap">
                <Text ff="monospace" size="sm" style={{ wordBreak: 'break-all' }}>{p}</Text>
                <CopyButton value={p} icon />
              </Group>
            ))}
          </Stack>
        </Panel>
      )}
      <PrivacyNote>Generated with crypto.getRandomValues() using unbiased rejection sampling. Nothing leaves your browser.</PrivacyNote>
    </Stack>
  );
}

function Checker() {
  const [pw, setPw] = useState('');
  const [pwned, setPwned] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => { setPwned(null); }, [pw]);

  // k-anonymity: only the first 5 hex chars of the SHA-1 hash are sent; the match happens locally.
  const checkPwned = async () => {
    setChecking(true);
    try {
      const hash = bytesToHex(await digest('SHA-1', pw)).toUpperCase();
      const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, { headers: { 'Add-Padding': 'true' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const line = text.split('\n').find((l) => l.startsWith(hash.slice(5)));
      const n = line ? parseInt(line.split(':')[1], 10) : 0;
      setPwned({ count: n });
    } catch (e) {
      setPwned({ error: e.message });
    }
    setChecking(false);
  };

  return (
    <Stack gap="md">
      <PasswordInput size="md" label="Password to analyze" placeholder="Type a password…" value={pw}
        onChange={(e) => setPw(e.currentTarget.value)} autoComplete="off" />
      {pw && <Panel><StrengthMeter password={pw} /></Panel>}
      {pw && (
        <Panel title="Breach check (Have I Been Pwned)" icon={IconWorldSearch}>
          <Text size="xs" c="dimmed" mb="sm">
            Optional. Uses k-anonymity: only the first 5 characters of the password&apos;s SHA-1 hash are sent to
            api.pwnedpasswords.com — the password itself never leaves your browser.
          </Text>
          <Group>
            <Button size="xs" variant="light" leftSection={<IconShieldSearch size={14} />} loading={checking} onClick={checkPwned}>
              Check against 900M+ breached passwords
            </Button>
            {pwned?.count > 0 && <Badge color="red" size="lg">Found in {pwned.count.toLocaleString()} breaches — do not use</Badge>}
            {pwned?.count === 0 && <Badge color="teal" size="lg">Not found in known breaches</Badge>}
          </Group>
          {pwned?.error && <Alert color="orange" mt="sm">Could not reach the API: {pwned.error}</Alert>}
        </Panel>
      )}
    </Stack>
  );
}

export default function PasswordTools() {
  const [tab, setTab] = useState('generate');
  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="generate" leftSection={<IconPassword size={14} />}>Generator</Tabs.Tab>
          <Tabs.Tab value="check" leftSection={<IconShieldSearch size={14} />}>Strength checker</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'generate' ? <Generator /> : <Checker />}
    </Stack>
  );
}
