import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack, Group, Button, NumberInput, Switch, Select, Text, Textarea, Badge, Tabs, TextInput, Alert, SimpleGrid } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { v1 as uuidv1, v4 as uuidv4, v7 as uuidv7, validate, version as uuidVersion, NIL, MAX } from 'uuid';
import CopyButton from '@/shared/components/CopyButton';
import DownloadButton from '@/shared/components/DownloadButton';
import { Panel, KVTable } from '@/shared/components/ui';
import { randomBytes, randomInt } from '@/shared/lib/crypto';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const NANO = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

function ulid() {
  let t = Date.now(), time = '';
  for (let i = 0; i < 10; i++) { time = CROCKFORD[t % 32] + time; t = Math.floor(t / 32); }
  const rnd = randomBytes(16);
  let r = '';
  for (let i = 0; i < 16; i++) r += CROCKFORD[rnd[i] & 31];
  return time + r;
}

const nanoid = (size, alphabet) => Array.from({ length: size }, () => alphabet[randomInt(alphabet.length)]).join('');

const KINDS = {
  v4: { label: 'UUID v4 (random)', gen: () => uuidv4() },
  v7: { label: 'UUID v7 (time-ordered, DB-friendly)', gen: () => uuidv7() },
  v1: { label: 'UUID v1 (timestamp + node)', gen: () => uuidv1() },
  ulid: { label: 'ULID (sortable, 26 chars)', gen: () => ulid() },
  nanoid: { label: 'NanoID (URL-safe)', gen: null },
  nil: { label: 'Nil / Max UUID', gen: null },
};

function inspect(raw) {
  const s = raw.trim();
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(s)) {
    const t = [...s.slice(0, 10).toUpperCase()].reduce((n, c) => n * 32 + CROCKFORD.indexOf(c), 0);
    return { type: 'ULID', rows: [['Timestamp', new Date(t).toISOString()], ['Randomness', s.slice(10)]] };
  }
  if (!validate(s)) return { error: 'Not a valid UUID or ULID' };
  const v = uuidVersion(s);
  const hex = s.replace(/-/g, '');
  const variantNibble = parseInt(hex[16], 16);
  const variant = variantNibble >= 0xe ? 'Reserved (future)' : variantNibble >= 0xc ? 'Microsoft (legacy)' : variantNibble >= 0x8 ? 'RFC 9562 / 4122' : 'NCS (legacy)';
  const rows = [['Version', String(v)], ['Variant', variant]];
  if (v === 7) rows.push(['Timestamp', new Date(parseInt(hex.slice(0, 12), 16)).toISOString()]);
  if (v === 1) {
    const ts = BigInt(`0x${hex.slice(13, 16)}${hex.slice(8, 12)}${hex.slice(0, 8)}`);
    rows.push(['Timestamp', new Date(Number((ts - 122192928000000000n) / 10000n)).toISOString()]);
    rows.push(['Node (MAC / random)', hex.slice(20).match(/.{2}/g).join(':')]);
  }
  if (v === 4) rows.push(['Random bits', '122']);
  return { type: `UUID v${v}`, rows };
}

export default function UuidGenerator() {
  const [kind, setKind] = useState('v4');
  const [count, setCount] = useState(10);
  const [uppercase, setUppercase] = useState(false);
  const [noDashes, setNoDashes] = useState(false);
  const [braces, setBraces] = useState(false);
  const [nanoSize, setNanoSize] = useState(21);
  const [output, setOutput] = useState('');
  const [inspectInput, setInspectInput] = useState('');
  const [tab, setTab] = useState('gen');

  const generate = useCallback(() => {
    const list = Array.from({ length: count }, (_, i) => {
      let u;
      if (kind === 'nanoid') u = nanoid(nanoSize, NANO);
      else if (kind === 'nil') u = i % 2 ? MAX : NIL;
      else u = KINDS[kind].gen();
      if (kind.startsWith('v') || kind === 'nil') {
        if (noDashes) u = u.replace(/-/g, '');
        if (braces) u = `{${u}}`;
      }
      return uppercase ? u.toUpperCase() : u;
    });
    setOutput(list.join('\n'));
  }, [kind, count, uppercase, noDashes, braces, nanoSize]);

  useEffect(() => { generate(); }, [generate]);

  const info = useMemo(() => (inspectInput.trim() ? inspect(inspectInput) : null), [inspectInput]);

  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="gen">Generate</Tabs.Tab>
          <Tabs.Tab value="inspect">Inspect / validate</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'gen' ? (
        <SimpleGrid cols={{ base: 1, lg: 3 }}>
          <Panel title="Options">
            <Stack gap="sm">
              <Select label="Type" value={kind} onChange={setKind} allowDeselect={false} data={Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label }))} />
              <NumberInput label="Count" value={count} onChange={(v) => setCount(Math.max(1, Math.min(10000, Number(v) || 1)))} min={1} max={10000} />
              {kind === 'nanoid' && <NumberInput label="Length" value={nanoSize} onChange={(v) => setNanoSize(Math.max(4, Math.min(64, Number(v) || 21)))} min={4} max={64} />}
              <Switch label="Uppercase" checked={uppercase} onChange={(e) => setUppercase(e.currentTarget.checked)} />
              {(kind.startsWith('v') || kind === 'nil') && <Switch label="Remove dashes" checked={noDashes} onChange={(e) => setNoDashes(e.currentTarget.checked)} />}
              {(kind.startsWith('v') || kind === 'nil') && <Switch label="Wrap in {braces} (GUID)" checked={braces} onChange={(e) => setBraces(e.currentTarget.checked)} />}
              <Button leftSection={<IconRefresh size={16} />} onClick={generate}>Regenerate</Button>
              {kind === 'v7' && <Text size="xs" c="dimmed">v7 embeds a millisecond timestamp so IDs sort by creation time — ideal for database primary keys.</Text>}
              {kind === 'v1' && <Text size="xs" c="orange">v1 leaks the generation time; prefer v4 or v7.</Text>}
            </Stack>
          </Panel>
          <div className="lg:col-span-2">
            <Panel title="Generated" actions={<>
              <Badge variant="light">{count}</Badge>
              <CopyButton value={output} icon />
              <DownloadButton data={output} filename={`${kind}-ids.txt`} variant="subtle" size="compact-xs" />
            </>}>
              <Textarea value={output} readOnly autosize minRows={12} maxRows={24} className="code-font" />
            </Panel>
          </div>
        </SimpleGrid>
      ) : (
        <Stack gap="md">
          <TextInput size="md" placeholder="Paste a UUID or ULID" value={inspectInput} onChange={(e) => setInspectInput(e.currentTarget.value)} className="code-font" />
          {info?.error && <Alert color="red" p="xs">{info.error}</Alert>}
          {info?.rows && <Panel title={info.type}><KVTable rows={info.rows} labelWidth={160} /></Panel>}
        </Stack>
      )}
    </Stack>
  );
}
