import { useMemo, useState } from 'react';
import { Stack, Group, TextInput, Select, NumberInput, Alert, SimpleGrid, Text, SegmentedControl } from '@mantine/core';
import { Panel, KVTable } from '@/shared/components/ui';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

function parseBig(str, base) {
  let s = str.trim().toLowerCase().replace(/[_\s,]/g, '');
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  if (base === 16) s = s.replace(/^0x/, '');
  if (base === 2) s = s.replace(/^0b/, '');
  if (base === 8) s = s.replace(/^0o/, '');
  if (!s) throw new Error('Enter a number');
  let n = 0n;
  const b = BigInt(base);
  for (const ch of s) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= base) throw new Error(`“${ch}” is not a valid base-${base} digit`);
    n = n * b + BigInt(d);
  }
  return neg ? -n : n;
}

const group = (s, size, sep = ' ') => s.replace(new RegExp(`\\B(?=(.{${size}})+(?!.))`, 'g'), sep);

function twos(n, bits) {
  const mod = 1n << BigInt(bits);
  const min = -(mod >> 1n), max = mod - 1n;
  if (n < min || n > max) return null;
  return ((n % mod) + mod) % mod;
}

export default function NumberBase() {
  const [input, setInput] = useState('255');
  const [base, setBase] = useState('10');
  const [custom, setCustom] = useState(36);
  const [bits, setBits] = useState('32');

  const r = useMemo(() => {
    try { return { n: parseBig(input, Number(base)) }; } catch (e) { return { error: e.message }; }
  }, [input, base]);

  const n = r.n;
  const abs = n != null && n < 0n ? -n : n;
  const sign = n != null && n < 0n ? '-' : '';
  const tw = n != null ? twos(n, Number(bits)) : null;
  const bytes = abs != null ? Math.max(1, Math.ceil(abs.toString(16).length / 2)) : 0;
  const ascii = abs != null && abs < 0x110000n && abs >= 32n ? String.fromCodePoint(Number(abs)) : null;

  return (
    <Stack gap="md">
      <Panel>
        <Group align="flex-end" wrap="wrap">
          <TextInput size="md" label="Number" value={input} onChange={(e) => setInput(e.currentTarget.value)} className="code-font" style={{ flex: 1, minWidth: 240 }}
            error={r.error} />
          <Select size="md" label="Input base" value={base} onChange={setBase} allowDeselect={false} w={170}
            data={[{ value: '2', label: 'Binary (2)' }, { value: '8', label: 'Octal (8)' }, { value: '10', label: 'Decimal (10)' }, { value: '16', label: 'Hex (16)' },
              ...[3, 4, 5, 6, 7, 9, 11, 12, 20, 32, 36].map((b) => ({ value: String(b), label: `Base ${b}` }))]} />
        </Group>
      </Panel>
      {n != null && (
        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          <Panel title="Conversions">
            <KVTable labelWidth={110} rows={[
              ['Decimal', sign + group(abs.toString(10), 3, ',')],
              ['Hexadecimal', `${sign}0x${abs.toString(16).toUpperCase()}`],
              ['Octal', `${sign}0o${abs.toString(8)}`],
              ['Binary', `${sign}${group(abs.toString(2), 4)}`],
              ['Base 32', sign + abs.toString(32)],
              ['Base 36', sign + abs.toString(36)],
              [<Group gap={4} key="c">Base <NumberInput size="xs" w={60} value={custom} onChange={(v) => setCustom(Math.min(36, Math.max(2, Number(v) || 2)))} min={2} max={36} /></Group>, sign + abs.toString(custom)],
            ]} />
          </Panel>
          <Panel title="Machine representation">
            <SegmentedControl size="xs" value={bits} onChange={setBits} data={['8', '16', '32', '64', '128']} mb="sm" />
            {tw == null ? (
              <Alert color="orange" p="xs">Value does not fit in a signed/unsigned {bits}-bit integer.</Alert>
            ) : (
              <KVTable labelWidth={130} rows={[
                [`Two's complement (${bits}-bit)`, group(tw.toString(2).padStart(Number(bits), '0'), 8)],
                ['Hex (two\'s complement)', `0x${tw.toString(16).toUpperCase().padStart(Number(bits) / 4, '0')}`],
                ['As unsigned', tw.toString()],
                ['As signed', (tw >= 1n << BigInt(Number(bits) - 1) ? tw - (1n << BigInt(bits)) : tw).toString()],
              ]} />
            )}
            <Text size="xs" c="dimmed" mt="sm">
              {bytes} byte{bytes > 1 ? 's' : ''} · {abs.toString(2).length} significant bits{ascii ? ` · character “${ascii}”` : ''}
            </Text>
          </Panel>
        </SimpleGrid>
      )}
    </Stack>
  );
}
