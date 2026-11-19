import { useMemo, useState } from 'react';
import { Stack, Group, Checkbox, Table, TextInput, Text, SimpleGrid, Alert, Code } from '@mantine/core';
import { Panel, KVTable, FindingList, PrivacyNote } from '@/shared/components/ui';

const WHO = [['u', 'Owner'], ['g', 'Group'], ['o', 'Others']];
const PERMS = [['r', 'Read', 4], ['w', 'Write', 2], ['x', 'Execute', 1]];
const SPECIAL = [['suid', 'SetUID', 4], ['sgid', 'SetGID', 2], ['sticky', 'Sticky', 1]];

function fromOctal(str) {
  const s = str.trim();
  if (!/^[0-7]{3,4}$/.test(s)) return null;
  const d = s.padStart(4, '0').split('').map(Number);
  const state = { special: {}, u: {}, g: {}, o: {} };
  SPECIAL.forEach(([k, , v]) => { state.special[k] = !!(d[0] & v); });
  WHO.forEach(([w], i) => PERMS.forEach(([p, , v]) => { state[w][p] = !!(d[i + 1] & v); }));
  return state;
}

function fromSymbolic(str) {
  const s = str.trim().replace(/^[-dlcbps]/, (m) => (str.trim().length === 10 ? '' : m));
  if (!/^[rwxsStT-]{9}$/.test(s)) return null;
  const state = { special: { suid: false, sgid: false, sticky: false }, u: {}, g: {}, o: {} };
  WHO.forEach(([w], i) => {
    const t = s.slice(i * 3, i * 3 + 3);
    state[w].r = t[0] === 'r';
    state[w].w = t[1] === 'w';
    state[w].x = /[xst]/.test(t[2]);
    if (/[sS]/.test(t[2]) && w === 'u') state.special.suid = true;
    if (/[sS]/.test(t[2]) && w === 'g') state.special.sgid = true;
    if (/[tT]/.test(t[2]) && w === 'o') state.special.sticky = true;
  });
  return state;
}

export default function ChmodCalculator() {
  const [state, setState] = useState(() => fromOctal('0755'));
  const [octIn, setOctIn] = useState('');
  const [symIn, setSymIn] = useState('');

  const octal = useMemo(() => {
    const sp = SPECIAL.reduce((n, [k, , v]) => n + (state.special[k] ? v : 0), 0);
    const digits = WHO.map(([w]) => PERMS.reduce((n, [p, , v]) => n + (state[w][p] ? v : 0), 0));
    return `${sp}${digits.join('')}`;
  }, [state]);

  const symbolic = useMemo(() => WHO.map(([w]) => {
    let t = (state[w].r ? 'r' : '-') + (state[w].w ? 'w' : '-');
    const x = state[w].x;
    if (w === 'u' && state.special.suid) t += x ? 's' : 'S';
    else if (w === 'g' && state.special.sgid) t += x ? 's' : 'S';
    else if (w === 'o' && state.special.sticky) t += x ? 't' : 'T';
    else t += x ? 'x' : '-';
    return t;
  }).join(''), [state]);

  const short = octal.startsWith('0') ? octal.slice(1) : octal;
  const ugo = WHO.map(([w]) => `${w}=${PERMS.filter(([p]) => state[w][p]).map(([p]) => p).join('')}`).join(',');

  const findings = useMemo(() => {
    const f = [];
    if (state.o.w) f.push({ level: 'high', title: 'World-writable', detail: 'Any local user can modify this file. Avoid on anything that is executed or included.' });
    if (state.special.suid) f.push({ level: state.u.x ? 'high' : 'medium', title: 'SetUID bit set', detail: 'The program runs with the owner’s privileges — a common privilege-escalation vector (GTFOBins). Audit with: find / -perm -4000 -type f 2>/dev/null' });
    if (state.special.sgid) f.push({ level: 'medium', title: 'SetGID bit set', detail: 'Runs with the group’s privileges, or new files in a directory inherit its group.' });
    if (state.special.sticky) f.push({ level: 'info', title: 'Sticky bit', detail: 'On directories (like /tmp) only the owner can delete their files.' });
    if (state.o.r && !state.o.w) f.push({ level: 'low', title: 'World-readable', detail: 'Fine for public files — never for private keys, .env files or credentials (use 600 / 640).' });
    if (!f.length) f.push({ level: 'pass', title: 'No risky bits', detail: 'Not world-writable and no special bits set.' });
    return f;
  }, [state]);

  const toggle = (who, p) => setState((s) => ({ ...s, [who]: { ...s[who], [p]: !s[who][p] } }));

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <TextInput label="From octal" placeholder="e.g. 644 or 4755" value={octIn}
          onChange={(e) => { setOctIn(e.currentTarget.value); const s = fromOctal(e.currentTarget.value); if (s) setState(s); }} />
        <TextInput label="From symbolic (ls -l)" placeholder="e.g. -rwxr-xr-x or rwsr-xr-x" value={symIn}
          onChange={(e) => { setSymIn(e.currentTarget.value); const s = fromSymbolic(e.currentTarget.value); if (s) setState(s); }} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title="Permissions">
          <Table withRowBorders={false}>
            <Table.Thead><Table.Tr><Table.Th /> {PERMS.map(([p, l]) => <Table.Th key={p}>{l}</Table.Th>)}</Table.Tr></Table.Thead>
            <Table.Tbody>
              {WHO.map(([w, l]) => (
                <Table.Tr key={w}>
                  <Table.Td><Text size="sm" fw={500}>{l}</Text></Table.Td>
                  {PERMS.map(([p]) => <Table.Td key={p}><Checkbox checked={!!state[w][p]} onChange={() => toggle(w, p)} /></Table.Td>)}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group mt="sm" gap="lg">
            {SPECIAL.map(([k, l]) => (
              <Checkbox key={k} label={l} checked={!!state.special[k]} onChange={() => setState((s) => ({ ...s, special: { ...s.special, [k]: !s.special[k] } }))} />
            ))}
          </Group>
        </Panel>
        <Panel title="Result">
          <KVTable labelWidth={130} rows={[
            ['Octal', short],
            ['Octal (4-digit)', octal],
            ['Symbolic', symbolic],
            ['ls -l (file)', `-${symbolic}`],
            ['chmod', `chmod ${short} file`],
            ['chmod (u/g/o)', `chmod ${ugo} file`],
            ['find files with it', `find . -perm ${short}`],
          ]} />
        </Panel>
      </SimpleGrid>
      <Panel title="Security notes"><FindingList findings={findings} /></Panel>
      <Alert variant="light" color="gray" p="xs">
        <Text size="xs">Common: <Code>600</Code> private keys · <Code>644</Code> web files · <Code>640</Code> config with secrets · <Code>755</Code> dirs & scripts · <Code>1777</Code> /tmp · <Code>700</Code> ~/.ssh</Text>
      </Alert>
      <PrivacyNote />
    </Stack>
  );
}
