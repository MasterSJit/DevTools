import { useMemo, useState } from 'react';
import { Stack, SimpleGrid, SegmentedControl, Text, TextInput, Paper, Group, Badge, Alert } from '@mantine/core';
import { Panel, KVTable, PrivacyNote } from '@/shared/components/ui';
import CopyButton from '@/shared/components/CopyButton';

// CVSS v3.1 base metrics (FIRST specification).
const METRICS = [
  { key: 'AV', label: 'Attack Vector', opts: [['N', 'Network', 0.85], ['A', 'Adjacent', 0.62], ['L', 'Local', 0.55], ['P', 'Physical', 0.2]] },
  { key: 'AC', label: 'Attack Complexity', opts: [['L', 'Low', 0.77], ['H', 'High', 0.44]] },
  { key: 'PR', label: 'Privileges Required', opts: [['N', 'None', 0.85], ['L', 'Low', 0.62], ['H', 'High', 0.27]] },
  { key: 'UI', label: 'User Interaction', opts: [['N', 'None', 0.85], ['R', 'Required', 0.62]] },
  { key: 'S', label: 'Scope', opts: [['U', 'Unchanged'], ['C', 'Changed']] },
  { key: 'C', label: 'Confidentiality', opts: [['H', 'High', 0.56], ['L', 'Low', 0.22], ['N', 'None', 0]] },
  { key: 'I', label: 'Integrity', opts: [['H', 'High', 0.56], ['L', 'Low', 0.22], ['N', 'None', 0]] },
  { key: 'A', label: 'Availability', opts: [['H', 'High', 0.56], ['L', 'Low', 0.22], ['N', 'None', 0]] },
];

const HELP = {
  AV: 'Network = exploitable remotely over the internet; Physical = needs hands on the device.',
  AC: 'High = needs special conditions (race, MITM position, non-default config).',
  PR: 'Privileges the attacker must already have before exploiting.',
  UI: 'Required = a victim must click a link, open a file, etc.',
  S: 'Changed = impact reaches beyond the vulnerable component (e.g. stored XSS affecting other users’ browsers, VM escape).',
  C: 'Impact on data confidentiality.', I: 'Impact on data integrity.', A: 'Impact on availability.',
};

// Round up to one decimal as defined in CVSS 3.1 Appendix A.
const roundup = (x) => { const i = Math.round(x * 100000); return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10; };

function score(v) {
  const w = (k) => METRICS.find((m) => m.key === k).opts.find((o) => o[0] === v[k])[2];
  const changed = v.S === 'C';
  const pr = v.PR === 'L' ? (changed ? 0.68 : 0.62) : v.PR === 'H' ? (changed ? 0.5 : 0.27) : 0.85;
  const iss = 1 - (1 - w('C')) * (1 - w('I')) * (1 - w('A'));
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15 : 6.42 * iss;
  const exploitability = 8.22 * w('AV') * w('AC') * pr * w('UI');
  const base = impact <= 0 ? 0 : changed ? roundup(Math.min(1.08 * (impact + exploitability), 10)) : roundup(Math.min(impact + exploitability, 10));
  return { base, impact: Math.max(0, impact), exploitability };
}

const severity = (s) => (s === 0 ? ['None', 'gray'] : s < 4 ? ['Low', 'yellow'] : s < 7 ? ['Medium', 'orange'] : s < 9 ? ['High', 'red'] : ['Critical', 'grape']);

const PRESETS = {
  'SQL injection (unauthenticated)': 'AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
  'Stored XSS': 'AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N',
  'Reflected XSS': 'AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N',
  'IDOR (read other users’ data)': 'AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N',
  'CSRF on state change': 'AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N',
  'Missing security headers': 'AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N',
  'Remote code execution': 'AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H',
  'Local privilege escalation': 'AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
};

const parseVector = (str) => {
  const parts = Object.fromEntries(str.replace(/^CVSS:3\.[01]\//, '').split('/').map((p) => p.split(':')));
  return METRICS.every((m) => m.opts.some((o) => o[0] === parts[m.key])) ? Object.fromEntries(METRICS.map((m) => [m.key, parts[m.key]])) : null;
};

export default function CvssCalculator() {
  const [v, setV] = useState(parseVector(PRESETS['SQL injection (unauthenticated)']));
  const [vecIn, setVecIn] = useState('');

  const vector = `CVSS:3.1/${METRICS.map((m) => `${m.key}:${v[m.key]}`).join('/')}`;
  const s = useMemo(() => score(v), [v]);
  const [sev, color] = severity(s.base);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <TextInput label="Paste a vector" placeholder="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" value={vecIn}
          error={vecIn && !parseVector(vecIn.trim()) ? 'Not a complete CVSS 3.x base vector' : null}
          onChange={(e) => { setVecIn(e.currentTarget.value); const p = parseVector(e.currentTarget.value.trim()); if (p) setV(p); }} />
        <div>
          <Text size="sm" fw={500} mb={4}>Common findings</Text>
          <Group gap={6}>
            {Object.entries(PRESETS).map(([name, vec]) => (
              <Badge key={name} variant={vector.endsWith(vec) ? 'filled' : 'light'} style={{ cursor: 'pointer', textTransform: 'none' }} onClick={() => setV(parseVector(vec))}>{name}</Badge>
            ))}
          </Group>
        </div>
      </SimpleGrid>

      <Paper p="md">
        <Group justify="space-between" wrap="wrap">
          <Group>
            <div className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center"
              style={{ background: `var(--mantine-color-${color}-light)`, color: `var(--mantine-color-${color}-light-color)` }}>
              <Text fz={28} fw={800} lh={1}>{s.base.toFixed(1)}</Text>
              <Text size="xs" fw={600}>{sev}</Text>
            </div>
            <div>
              <Group gap={4}><Text ff="monospace" size="sm" fw={600}>{vector}</Text><CopyButton value={vector} icon /></Group>
              <Text size="xs" c="dimmed">Impact {s.impact.toFixed(1)} · Exploitability {s.exploitability.toFixed(1)}</Text>
            </div>
          </Group>
          <CopyButton value={`${sev} (${s.base.toFixed(1)}) — ${vector}`} />
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        {METRICS.map((m) => (
          <Paper key={m.key} p="sm">
            <Text size="sm" fw={600}>{m.label} <Text span c="dimmed" size="xs">({m.key})</Text></Text>
            <Text size="xs" c="dimmed" mb={6}>{HELP[m.key]}</Text>
            <SegmentedControl fullWidth size="xs" value={v[m.key]} onChange={(val) => setV((p) => ({ ...p, [m.key]: val }))}
              data={m.opts.map(([value, label]) => ({ value, label }))} />
          </Paper>
        ))}
      </SimpleGrid>

      <Panel title="Severity scale">
        <KVTable labelWidth={120} rows={[['None', '0.0', { copy: false }], ['Low', '0.1 – 3.9', { copy: false }], ['Medium', '4.0 – 6.9', { copy: false }], ['High', '7.0 – 8.9', { copy: false }], ['Critical', '9.0 – 10.0', { copy: false }]]} />
      </Panel>
      <Alert variant="light" color="gray" p="xs"><Text size="xs">Base score per the FIRST CVSS v3.1 specification — ready to paste into VAPT / pentest reports and bug-bounty submissions.</Text></Alert>
      <PrivacyNote />
    </Stack>
  );
}
