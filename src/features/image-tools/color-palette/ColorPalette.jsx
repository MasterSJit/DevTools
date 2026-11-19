import { useEffect, useState } from 'react';
import { Stack, SimpleGrid, Slider, Text, Group, Paper, SegmentedControl, Image, UnstyledButton, Tooltip } from '@mantine/core';
import FileDropZone from '@/shared/components/FileDropZone';
import { Panel, OutputArea, PrivacyNote } from '@/shared/components/ui';
import CopyButton from '@/shared/components/CopyButton';

const hex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };

/** k-means++ on a downsampled copy of the image. Returns [{ rgb, share }] sorted by share. */
function extract(bitmap, k) {
  const side = 160; const s = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bitmap.width * s)); c.height = Math.max(1, Math.round(bitmap.height * s));
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bitmap, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const px = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 125) px.push([d[i], d[i + 1], d[i + 2]]);
  if (!px.length) return [];
  const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  // deterministic seeding: start from the most common coarse colour, then farthest-point (k-means++ style)
  const cent = [px[Math.floor(px.length / 2)]];
  while (cent.length < k) {
    let best = px[0], bd = -1;
    for (let i = 0; i < px.length; i += 3) { const m = Math.min(...cent.map((cc) => dist(px[i], cc))); if (m > bd) { bd = m; best = px[i]; } }
    cent.push(best);
  }
  const assign = new Int32Array(px.length);
  for (let it = 0; it < 12; it++) {
    const sum = cent.map(() => [0, 0, 0, 0]);
    px.forEach((p, i) => {
      let bi = 0, bd = Infinity;
      cent.forEach((cc, j) => { const dd = dist(p, cc); if (dd < bd) { bd = dd; bi = j; } });
      assign[i] = bi; const s2 = sum[bi]; s2[0] += p[0]; s2[1] += p[1]; s2[2] += p[2]; s2[3]++;
    });
    sum.forEach((s2, j) => { if (s2[3]) cent[j] = [Math.round(s2[0] / s2[3]), Math.round(s2[1] / s2[3]), Math.round(s2[2] / s2[3])]; });
  }
  const counts = cent.map(() => 0); assign.forEach((a) => counts[a]++);
  return cent.map((rgb, i) => ({ rgb, share: counts[i] / px.length })).filter((c2) => c2.share > 0).sort((a, b) => b.share - a.share);
}

export default function ColorPalette() {
  const [bmp, setBmp] = useState(null);
  const [url, setUrl] = useState(null);
  const [k, setK] = useState(6);
  const [colors, setColors] = useState([]);
  const [fmt, setFmt] = useState('css');

  const onFile = async (f) => { setUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(f); }); setBmp(await createImageBitmap(f)); };
  useEffect(() => { if (bmp) setColors(extract(bmp, k)); }, [bmp, k]);

  const names = colors.map((_, i) => (i === 0 ? 'primary' : i === 1 ? 'secondary' : `accent-${i - 1}`));
  const exportText = {
    css: `:root {\n${colors.map((c, i) => `  --color-${names[i]}: ${hex(c.rgb)};`).join('\n')}\n}`,
    tailwind: `// tailwind.config.js → theme.extend.colors\ncolors: {\n${colors.map((c, i) => `  '${names[i]}': '${hex(c.rgb)}',`).join('\n')}\n}`,
    json: JSON.stringify(colors.map((c, i) => ({ name: names[i], hex: hex(c.rgb), rgb: c.rgb, hsl: hsl(c.rgb), share: +(c.share * 100).toFixed(1) })), null, 2),
    scss: colors.map((c, i) => `$${names[i]}: ${hex(c.rgb)};`).join('\n'),
  }[fmt];

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title="Image">
          <FileDropZone onFile={onFile} accept={['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']} title="Drop an image, photo or screenshot" />
          {url && <Image src={url} mah={280} fit="contain" mt="sm" radius="md" alt="source" />}
          <Text size="xs" fw={600} c="dimmed" mt="md" mb={4}>COLOURS · {k}</Text>
          <Slider value={k} onChange={setK} min={2} max={12} marks={[{ value: 4 }, { value: 8 }]} />
        </Panel>
        <Stack gap="md">
          <Panel title="Palette">
            {colors.length ? (
              <>
                <div className="flex h-14 rounded-lg overflow-hidden">
                  {colors.map((c) => <div key={hex(c.rgb)} style={{ background: hex(c.rgb), flex: c.share }} />)}
                </div>
                <Stack gap={6} mt="sm">
                  {colors.map((c, i) => {
                    const [h, s, l] = hsl(c.rgb); const onLight = lum(c.rgb) > 0.4;
                    return (
                      <Paper key={hex(c.rgb)} p={6} withBorder radius="md">
                        <Group wrap="nowrap" gap="sm">
                          <Tooltip label="Copy HEX"><UnstyledButton onClick={() => navigator.clipboard?.writeText(hex(c.rgb))} className="w-12 h-12 rounded-md shrink-0 grid place-items-center" style={{ background: hex(c.rgb), color: onLight ? '#000' : '#fff', fontSize: 10, fontWeight: 700 }}>{Math.round(c.share * 100)}%</UnstyledButton></Tooltip>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={700} ff="monospace">{hex(c.rgb)} <Text span size="xs" c="dimmed" fw={400}>{names[i]}</Text></Text>
                            <Text size="xs" c="dimmed" ff="monospace">rgb({c.rgb.join(', ')}) · hsl({h}, {s}%, {l}%)</Text>
                          </div>
                          <CopyButton value={hex(c.rgb)} icon />
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              </>
            ) : <Text size="sm" c="dimmed">Drop an image to extract its dominant colours.</Text>}
          </Panel>
          {colors.length > 0 && (
            <Panel title="Export" actions={<SegmentedControl size="xs" value={fmt} onChange={setFmt} data={[{ value: 'css', label: 'CSS' }, { value: 'tailwind', label: 'Tailwind' }, { value: 'scss', label: 'SCSS' }, { value: 'json', label: 'JSON' }]} />}>
              <OutputArea label={fmt} value={exportText} minRows={5} filename={`palette.${fmt === 'tailwind' ? 'js' : fmt}`} />
            </Panel>
          )}
        </Stack>
      </SimpleGrid>
      <PrivacyNote />
    </Stack>
  );
}
