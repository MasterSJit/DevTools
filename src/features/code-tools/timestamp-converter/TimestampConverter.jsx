import { useEffect, useMemo, useState } from 'react';
import { Stack, Group, Text, TextInput, Select, SimpleGrid, Badge, Alert, Button, Paper } from '@mantine/core';
import { IconClock, IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';
import CopyButton from '@/shared/components/CopyButton';
import { Panel, KVTable } from '@/shared/components/ui';

const ZONES = (() => {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London']; }
})();

function parseEpoch(raw) {
  const s = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const digits = s.replace(/^-/, '').split('.')[0].length;
  const n = Number(s);
  // Guess the unit from the magnitude
  if (digits <= 11) return { ms: n * 1000, unit: 'seconds' };
  if (digits <= 14) return { ms: n, unit: 'milliseconds' };
  if (digits <= 17) return { ms: n / 1000, unit: 'microseconds' };
  return { ms: n / 1e6, unit: 'nanoseconds' };
}

function relative(ms) {
  const diff = (ms - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  for (const [u, s] of units) if (Math.abs(diff) >= s || u === 'second') return rtf.format(Math.round(diff / s), u);
  return '';
}

const fmtZone = (d, tz) => new Intl.DateTimeFormat('en-GB', {
  timeZone: tz, dateStyle: 'full', timeStyle: 'long', hourCycle: 'h23',
}).format(d);

export default function TimestampConverter() {
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState(false);
  const [input, setInput] = useState(() => String(Math.floor(Date.now() / 1000)));
  const [tz, setTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused]);

  const parsed = useMemo(() => {
    if (!input.trim()) return null;
    const ep = parseEpoch(input);
    if (ep) return { date: new Date(ep.ms), unit: ep.unit };
    const d = new Date(input.trim());
    if (!Number.isNaN(d.getTime())) return { date: d, unit: 'date string' };
    return { error: 'Could not parse — enter a Unix timestamp (s/ms/µs/ns) or a date like 2026-10-27T10:00:00Z' };
  }, [input]);

  const d = parsed?.date;
  const valid = d && !Number.isNaN(d.getTime());

  return (
    <Stack gap="md">
      <Paper p="md">
        <Group justify="space-between" wrap="wrap">
          <Group gap="lg">
            <div>
              <Text size="xs" c="dimmed">Current Unix time (s)</Text>
              <Group gap={4}><Text ff="monospace" fw={700} size="xl">{Math.floor(now / 1000)}</Text><CopyButton value={String(Math.floor(now / 1000))} icon /></Group>
            </div>
            <div>
              <Text size="xs" c="dimmed">Milliseconds</Text>
              <Group gap={4}><Text ff="monospace" fw={600}>{now}</Text><CopyButton value={String(now)} icon /></Group>
            </div>
            <div>
              <Text size="xs" c="dimmed">ISO 8601 (UTC)</Text>
              <Text ff="monospace" fw={600}>{new Date(now).toISOString()}</Text>
            </div>
          </Group>
          <Button size="xs" variant="light" leftSection={paused ? <IconPlayerPlay size={14} /> : <IconPlayerPause size={14} />} onClick={() => setPaused((p) => !p)}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
        </Group>
      </Paper>

      <Panel title="Convert" icon={IconClock}>
        <Group align="flex-end" wrap="wrap">
          <TextInput size="md" label="Timestamp or date" value={input} onChange={(e) => setInput(e.currentTarget.value)} className="code-font" style={{ flex: 1, minWidth: 260 }}
            placeholder="1730000000, 1730000000000, 2026-10-27 10:00, Tue, 27 Oct 2026 10:00:00 GMT" />
          <Button variant="default" onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>Now</Button>
          <Select label="Time zone" value={tz} onChange={(v) => v && setTz(v)} data={ZONES} searchable w={240} />
        </Group>
        {parsed?.unit && valid && <Badge mt="sm" variant="light">Interpreted as {parsed.unit}</Badge>}
      </Panel>

      {parsed?.error && <Alert color="red">{parsed.error}</Alert>}
      {valid && (
        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          <Panel title="Human readable">
            <KVTable labelWidth={130} rows={[
              [tz, fmtZone(d, tz), { mono: false }],
              ['UTC', fmtZone(d, 'UTC'), { mono: false }],
              ['Relative', relative(d.getTime()), { mono: false }],
              ['Day of year', String(Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 0))) / 86400000))],
              ['ISO week', (() => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); return String(Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7)); })()],
            ]} />
          </Panel>
          <Panel title="Machine formats">
            <KVTable labelWidth={130} rows={[
              ['Unix (s)', String(Math.floor(d.getTime() / 1000))],
              ['Unix (ms)', String(d.getTime())],
              ['ISO 8601', d.toISOString()],
              ['RFC 2822 / HTTP', d.toUTCString()],
              ['SQL DATETIME', d.toISOString().replace('T', ' ').slice(0, 19)],
              ['LDAP / Windows FILETIME', String(BigInt(d.getTime()) * 10000n + 116444736000000000n)],
            ]} />
          </Panel>
        </SimpleGrid>
      )}
    </Stack>
  );
}
