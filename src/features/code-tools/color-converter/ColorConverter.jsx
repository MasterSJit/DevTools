import { useMemo, useState } from 'react';
import { Stack, Group, TextInput, Paper, Text, SimpleGrid, Badge, Tooltip, ColorInput } from '@mantine/core';
import chroma from 'chroma-js';
import CopyButton from '@/shared/components/CopyButton';
import { Panel } from '@/shared/components/ui';

function Swatch({ color, label }) {
  return (
    <Tooltip label={`${label ? `${label} · ` : ''}${color} — click to copy`}>
      <button type="button" onClick={() => navigator.clipboard?.writeText(color)} aria-label={color}
        className="w-9 h-9 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700 transition-transform hover:scale-110"
        style={{ background: color }} />
    </Tooltip>
  );
}

function Contrast({ fg, bg }) {
  let ratio = null;
  try { ratio = chroma.contrast(fg, bg); } catch {}
  if (ratio == null) return <Text size="sm" c="red">Invalid color</Text>;
  const checks = [['AA normal text', 4.5], ['AA large text', 3], ['AAA normal text', 7], ['AAA large text', 4.5], ['UI components', 3]];
  return (
    <Stack gap="sm">
      <div className="rounded-xl p-5 border border-slate-200 dark:border-slate-700" style={{ background: bg, color: fg }}>
        <Text fw={700} size="xl" style={{ color: fg }}>The quick brown fox</Text>
        <Text size="sm" style={{ color: fg }}>Body text at normal size should reach 4.5:1 contrast.</Text>
      </div>
      <Group gap="sm">
        <Text fw={700} size="xl" ff="monospace">{ratio.toFixed(2)}:1</Text>
        {checks.map(([label, min]) => (
          <Badge key={label} color={ratio >= min ? 'teal' : 'red'} variant="light">{ratio >= min ? '✓' : '✗'} {label}</Badge>
        ))}
      </Group>
    </Stack>
  );
}

export default function ColorConverter() {
  const [input, setInput] = useState('#6366F1');
  const [fg, setFg] = useState('#ffffff');
  const [bg, setBg] = useState('#4f46e5');

  const color = useMemo(() => {
    try {
      const c = chroma(input.trim());
      const [h, s, l] = c.hsl();
      const hue = Number.isNaN(h) ? 0 : h;
      const at = (deg) => chroma.hsl((hue + deg + 360) % 360, s, l).hex();
      const [L, A, B] = c.lab();
      return {
        c,
        formats: [
          ['HEX', c.hex()],
          ['HEX (with alpha)', c.hex('rgba')],
          ['RGB', c.css('rgb')],
          ['HSL', c.css('hsl')],
          ['HSV', `hsv(${c.hsv().map((v, i) => (i === 0 ? Math.round(Number.isNaN(v) ? 0 : v) : `${Math.round(v * 100)}%`)).join(', ')})`],
          ['CMYK', `cmyk(${c.cmyk().map((v) => `${Math.round(v * 100)}%`).join(', ')})`],
          ['OKLCH', `oklch(${c.oklch().map((v, i) => (i === 2 ? (Number.isNaN(v) ? 0 : v).toFixed(1) : v.toFixed(3))).join(' ')})`],
          ['LAB', `lab(${L.toFixed(1)} ${A.toFixed(1)} ${B.toFixed(1)})`],
          ['RGB (0–1)', c.gl().slice(0, 3).map((v) => v.toFixed(3)).join(', ')],
          ['Integer', String(parseInt(c.hex().slice(1, 7), 16))],
        ],
        name: (() => { const n = c.name(); return n.startsWith('#') ? null : n; })(),
        luminance: c.luminance(),
        palettes: {
          Complementary: [c.hex(), at(180)],
          Analogous: [at(-30), c.hex(), at(30)],
          Triadic: [c.hex(), at(120), at(240)],
          'Split complementary': [c.hex(), at(150), at(210)],
          Tetradic: [c.hex(), at(90), at(180), at(270)],
        },
        shades: chroma.scale(['#ffffff', c.hex(), '#000000']).mode('lab').colors(11).slice(1, 10),
      };
    } catch { return null; }
  }, [input]);

  return (
    <Stack gap="md">
      <Group align="flex-end">
        <TextInput label="Any CSS color" value={input} onChange={(e) => setInput(e.currentTarget.value)} size="md"
          placeholder="#6366F1, rgb(99 102 241), hsl(239 84% 67%), rebeccapurple" style={{ flex: 1 }} className="code-font"
          error={!color && input ? 'Unrecognized color' : null} />
        <input type="color" value={color?.c.hex().slice(0, 7) || '#000000'} onChange={(e) => setInput(e.target.value)}
          style={{ width: 52, height: 42, border: 'none', background: 'transparent', cursor: 'pointer' }} aria-label="Pick color" />
      </Group>

      {color && (
        <>
          <Paper style={{ background: color.c.hex(), minHeight: 110 }} p="lg">
            <Text fw={700} size="xl" style={{ color: color.luminance > 0.45 ? '#000' : '#fff' }}>
              {color.c.hex().toUpperCase()}{color.name ? ` · ${color.name}` : ''}
            </Text>
            <Text size="xs" style={{ color: color.luminance > 0.45 ? '#000' : '#fff', opacity: 0.8 }}>Relative luminance {color.luminance.toFixed(4)}</Text>
          </Paper>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm">
            {color.formats.map(([label, value]) => (
              <Paper key={label} p="sm">
                <Group justify="space-between" wrap="nowrap" gap={4}>
                  <div style={{ minWidth: 0 }}>
                    <Text size="xs" c="dimmed">{label}</Text>
                    <Text size="sm" ff="monospace" truncate>{value}</Text>
                  </div>
                  <CopyButton value={value} icon />
                </Group>
              </Paper>
            ))}
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Panel title="Palettes (click a swatch to copy)">
              <Stack gap="xs">
                {Object.entries(color.palettes).map(([name, list]) => (
                  <Group key={name} gap="xs">
                    <Text size="xs" c="dimmed" w={140}>{name}</Text>
                    {list.map((c, i) => <Swatch key={`${c}${i}`} color={c} />)}
                  </Group>
                ))}
                <Group gap="xs">
                  <Text size="xs" c="dimmed" w={140}>Tints → shades</Text>
                  {color.shades.map((c, i) => <Swatch key={`${c}${i}`} color={c} label={`${(i + 1) * 100}`} />)}
                </Group>
              </Stack>
            </Panel>
            <Panel title="WCAG contrast checker">
              <Group grow mb="sm">
                <ColorInput label="Text" value={fg} onChange={setFg} />
                <ColorInput label="Background" value={bg} onChange={setBg} />
              </Group>
              <Group gap="xs" mb="sm">
                <Text size="xs" c="dimmed" component="button" type="button" className="bg-transparent border-0 cursor-pointer underline" onClick={() => setBg(color.c.hex())}>Use current as background</Text>
                <Text size="xs" c="dimmed" component="button" type="button" className="bg-transparent border-0 cursor-pointer underline" onClick={() => setFg(color.c.hex())}>Use current as text</Text>
              </Group>
              <Contrast fg={fg} bg={bg} />
            </Panel>
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
