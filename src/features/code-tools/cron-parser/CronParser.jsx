import { useMemo, useState } from 'react';
import { Stack, Group, TextInput, Text, Badge, Select, SimpleGrid, Table, Alert, NumberInput, Code } from '@mantine/core';
import cronParser from 'cron-parser';
import { IconClock } from '@tabler/icons-react';
import CopyButton from '@/shared/components/CopyButton';
import { Panel } from '@/shared/components/ui';

const PRESETS = [
  ['Every minute', '* * * * *'], ['Every 5 minutes', '*/5 * * * *'], ['Every 15 minutes', '*/15 * * * *'], ['Every hour', '0 * * * *'],
  ['Daily at midnight', '0 0 * * *'], ['Daily at 9:30', '30 9 * * *'], ['Weekdays at 9', '0 9 * * 1-5'], ['Every Monday', '0 9 * * 1'],
  ['1st of month', '0 0 1 * *'], ['Quarterly', '0 0 1 1,4,7,10 *'], ['Every 30 s (6-field)', '*/30 * * * * *'],
];

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MACROS = { '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *' };
const ZONES = (() => { try { return Intl.supportedValuesOf('timeZone'); } catch { return ['UTC']; } })();

const ALIASES = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const norm = (f) => f.toLowerCase().replace(/[a-z]{3}/g, (m) => ALIASES[m] ?? m);

function describeField(field, unit, names) {
  const f = norm(field);
  if (f === '*' || f === '?') return null;
  const name = (v) => (names ? names[Number(v)] : v);
  return f.split(',').map((part) => {
    const [range, step] = part.split('/');
    if (range === '*' && step) return `every ${step} ${unit}s`;
    if (range.includes('-')) {
      const [a, b] = range.split('-');
      return `${step ? `every ${step} ${unit}s ` : ''}${names ? `${name(a)} through ${name(b)}` : `${unit}s ${a}–${b}`}`;
    }
    return step ? `every ${step} ${unit}s starting at ${name(range)}` : names ? name(range) : `${unit} ${range}`;
  }).join(', ');
}

function describe(expr) {
  const parts = (MACROS[expr.trim()] || expr).trim().split(/\s+/);
  const [sec, min, hour, dom, mon, dow] = parts.length === 6 ? parts : [null, ...parts];
  const out = [];
  const plainTime = /^\d+$/.test(min) && /^\d+$/.test(hour);
  if (sec && sec !== '0') out.push(describeField(sec, 'second') || 'every second');
  if (plainTime) out.push(`at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}${sec && /^\d+$/.test(sec) && sec !== '0' ? `:${sec.padStart(2, '0')}` : ''}`);
  else {
    const m = describeField(min, 'minute');
    const h = describeField(hour, 'hour');
    if (!m && !h && !sec) out.push('every minute');
    if (m) out.push(/^\d+$/.test(min) ? `at minute ${min}` : m);
    if (h) out.push(/^\d+$/.test(hour) ? `during hour ${hour}` : h.replace(/^hours/, 'during hours'));
    else if (m) out.push('of every hour');
  }
  const d = describeField(dom, 'day');
  if (d) out.push(`on ${/^\d+$/.test(dom) ? `day ${dom}` : d} of the month`);
  const w = describeField(dow, 'weekday', DAYS);
  if (w) out.push(`${d ? 'and on' : 'on'} ${w}`);
  const mo = describeField(mon, 'month', MONTHS);
  if (mo) out.push(`in ${mo}`);
  const s = out.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function CronParser() {
  const [expr, setExpr] = useState('*/15 9-17 * * 1-5');
  const [tz, setTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [count, setCount] = useState(10);

  const result = useMemo(() => {
    try {
      const e = MACROS[expr.trim()] || expr.trim();
      const fields = e.split(/\s+/).length;
      if (fields < 5 || fields > 6) throw new Error(`Expected 5 or 6 fields, got ${fields}`);
      const interval = cronParser.parseExpression(e, { tz });
      const runs = [];
      for (let i = 0; i < count; i++) runs.push(interval.next().toDate());
      return { runs, description: describe(e), fields: e.split(/\s+/) };
    } catch (err) { return { error: err.message }; }
  }, [expr, tz, count]);

  const labels = result.fields?.length === 6 ? ['second', 'minute', 'hour', 'day (month)', 'month', 'day (week)'] : ['minute', 'hour', 'day (month)', 'month', 'day (week)'];
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <Stack gap="md">
      <Panel>
        <Group align="flex-end" wrap="nowrap">
          <TextInput label="Cron expression" value={expr} onChange={(e) => setExpr(e.currentTarget.value)} placeholder="*/5 * * * *"
            leftSection={<IconClock size={16} />} size="md" style={{ flex: 1 }} error={result.error}
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 18 } }} />
          <CopyButton value={expr} icon />
        </Group>
        <Group gap={6} mt="sm">
          {PRESETS.map(([label, value]) => (
            <Badge key={value} variant={expr === value ? 'filled' : 'light'} style={{ cursor: 'pointer' }} onClick={() => setExpr(value)} tt="none">{label}</Badge>
          ))}
        </Group>
      </Panel>

      {!result.error && (
        <>
          <Alert color="indigo" variant="light" title="Meaning">
            <Text size="lg" fw={500}>{result.description}</Text>
          </Alert>
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Panel title="Fields">
              <Table verticalSpacing={4}>
                <Table.Tbody>
                  {result.fields.map((f, i) => (
                    <Table.Tr key={i}><Table.Td w={140}><Text size="xs" c="dimmed">{labels[i]}</Text></Table.Td><Table.Td><Code>{f}</Code></Table.Td></Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Text size="xs" c="dimmed" mt="sm">Syntax: <Code>*</Code> any · <Code>,</Code> list · <Code>-</Code> range · <Code>/</Code> step · names like MON, JAN · macros like @daily.</Text>
            </Panel>
            <Panel title="Upcoming runs" actions={<>
              <Select size="xs" value={tz} onChange={(v) => v && setTz(v)} data={ZONES} searchable w={190} />
              <NumberInput size="xs" value={count} onChange={(v) => setCount(Math.max(1, Math.min(50, Number(v) || 10)))} min={1} max={50} w={70} />
            </>}>
              <Stack gap={4}>
                {result.runs.map((d, i) => (
                  <Group key={i} justify="space-between">
                    <Text size="sm" ff="monospace">{fmt.format(d)}</Text>
                    <Text size="xs" c="dimmed">{i === 0 ? `in ${Math.max(0, Math.round((d - Date.now()) / 60000))} min` : ''}</Text>
                  </Group>
                ))}
              </Stack>
            </Panel>
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
