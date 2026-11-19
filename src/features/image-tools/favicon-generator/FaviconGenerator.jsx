import { useEffect, useState } from 'react';
import { Stack, SimpleGrid, SegmentedControl, TextInput, ColorInput, Slider, Text, Group, Button, Paper, Switch, Code } from '@mantine/core';
import { IconFileZip } from '@tabler/icons-react';
import FileDropZone from '@/shared/components/FileDropZone';
import { Panel, PrivacyNote } from '@/shared/components/ui';
import { downloadBlob } from '@/shared/lib/download';

const PNG_SIZES = [
  ['favicon-16x16.png', 16], ['favicon-32x32.png', 32], ['favicon-48x48.png', 48], ['apple-touch-icon.png', 180],
  ['android-chrome-192x192.png', 192], ['android-chrome-512x512.png', 512], ['maskable-512x512.png', 512, true],
];

/** Pack PNG images into a .ico container (PNG-in-ICO, supported by every modern browser and Windows Vista+). */
async function buildIco(pngs) {
  const bufs = await Promise.all(pngs.map((p) => p.blob.arrayBuffer()));
  const header = new DataView(new ArrayBuffer(6 + 16 * pngs.length));
  header.setUint16(0, 0, true); header.setUint16(2, 1, true); header.setUint16(4, pngs.length, true);
  let offset = 6 + 16 * pngs.length;
  pngs.forEach((p, i) => {
    const o = 6 + i * 16;
    header.setUint8(o, p.size >= 256 ? 0 : p.size); header.setUint8(o + 1, p.size >= 256 ? 0 : p.size);
    header.setUint16(o + 4, 1, true); header.setUint16(o + 6, 32, true);
    header.setUint32(o + 8, bufs[i].byteLength, true); header.setUint32(o + 12, offset, true);
    offset += bufs[i].byteLength;
  });
  return new Blob([header.buffer, ...bufs], { type: 'image/x-icon' });
}

function drawIcon(size, src, opt, maskable) {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  const radius = (opt.radius / 100) * size / 2;
  if (opt.bg !== 'transparent' || maskable) {
    x.fillStyle = opt.bg === 'transparent' ? '#ffffff' : opt.bgColor;
    if (maskable) x.fillRect(0, 0, size, size);
    else { x.beginPath(); x.roundRect(0, 0, size, size, radius); x.fill(); }
  }
  // Maskable icons need content inside the central 80% "safe zone".
  const pad = (maskable ? Math.max(opt.padding, 12) : opt.padding) / 100 * size;
  const box = size - pad * 2;
  if (opt.mode === 'image' && src) {
    const k = Math.min(box / src.width, box / src.height);
    const w = src.width * k, h = src.height * k;
    x.drawImage(src, (size - w) / 2, (size - h) / 2, w, h);
  } else {
    x.fillStyle = opt.fg;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    let fs = box; x.font = `700 ${fs}px Inter, system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    const tw = x.measureText(opt.text).width;
    if (tw > box) { fs *= box / tw; x.font = `700 ${fs}px Inter, system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; }
    x.fillText(opt.text, size / 2, size / 2 + fs * 0.06);
  }
  return new Promise((r) => c.toBlob((b) => r({ blob: b, url: URL.createObjectURL(b), size }), 'image/png'));
}

export default function FaviconGenerator() {
  const [opt, setOpt] = useState({ mode: 'text', text: 'D', fg: '#ffffff', bg: 'color', bgColor: '#7c3aed', radius: 40, padding: 14 });
  const [src, setSrc] = useState(null);
  const [icons, setIcons] = useState([]);
  const [appName, setAppName] = useState('My App');
  const [svgName, setSvgName] = useState('');
  const set = (p) => setOpt((o) => ({ ...o, ...p }));

  const onFile = async (f) => {
    if (f.type === 'image/svg+xml') setSvgName(f.name); else setSvgName('');
    setSrc(await createImageBitmap(f).catch(async () => {
      // SVGs without intrinsic size can fail createImageBitmap — fall back to an <img>.
      const url = URL.createObjectURL(f); const img = new Image(); img.src = url; await img.decode(); return img;
    }));
    set({ mode: 'image' });
  };

  useEffect(() => {
    let alive = true;
    Promise.all(PNG_SIZES.map(([name, size, mask]) => drawIcon(size, src, opt, mask).then((r) => ({ ...r, name, mask })))).then((list) => {
      if (!alive) { list.forEach((i) => URL.revokeObjectURL(i.url)); return; }
      setIcons((old) => { old.forEach((i) => URL.revokeObjectURL(i.url)); return list; });
    });
    return () => { alive = false; };
  }, [opt, src]);

  const safeName = appName.replace(/[<>"&]/g, '').slice(0, 60) || 'App';
  const manifest = JSON.stringify({
    name: safeName, short_name: safeName.slice(0, 12),
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    theme_color: opt.bgColor, background_color: '#ffffff', display: 'standalone',
  }, null, 2);
  const html = `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${opt.bgColor}">`;

  const zip = async () => {
    const JSZip = (await import('jszip')).default;
    const z = new JSZip();
    icons.forEach((i) => z.file(i.name, i.blob));
    z.file('favicon.ico', await buildIco(icons.filter((i) => [16, 32, 48].includes(i.size) && !i.mask)));
    z.file('site.webmanifest', manifest);
    z.file('favicon-snippet.html', `${html}\n`);
    downloadBlob(await z.generateAsync({ type: 'blob' }), 'favicons.zip');
  };

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title="Source">
          <Stack gap="sm">
            <SegmentedControl value={opt.mode} onChange={(m) => set({ mode: m })} data={[{ value: 'text', label: 'Letter / emoji' }, { value: 'image', label: 'Image / logo' }]} />
            {opt.mode === 'text'
              ? <TextInput label="Text (1–2 characters or an emoji)" value={opt.text} maxLength={4} onChange={(e) => set({ text: e.currentTarget.value })} />
              : <FileDropZone onFile={onFile} accept={['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']} title={svgName || 'Drop a square logo (SVG or 512px+ PNG works best)'} />}
            {opt.mode === 'text' && <ColorInput label="Text colour" value={opt.fg} onChange={(v) => set({ fg: v })} />}
            <Switch label="Background" checked={opt.bg !== 'transparent'} onChange={(e) => set({ bg: e.currentTarget.checked ? 'color' : 'transparent' })} />
            {opt.bg !== 'transparent' && <ColorInput label="Background colour" value={opt.bgColor} onChange={(v) => set({ bgColor: v })} />}
            <div><Text size="xs" fw={600} c="dimmed" mb={4}>CORNER RADIUS · {opt.radius}%</Text><Slider value={opt.radius} onChange={(v) => set({ radius: v })} min={0} max={100} /></div>
            <div><Text size="xs" fw={600} c="dimmed" mb={4}>PADDING · {opt.padding}%</Text><Slider value={opt.padding} onChange={(v) => set({ padding: v })} min={0} max={30} /></div>
            <TextInput label="App name (for the manifest)" value={appName} onChange={(e) => setAppName(e.currentTarget.value)} />
          </Stack>
        </Panel>
        <Stack gap="md">
          <Panel title="Preview" actions={<Button size="xs" leftSection={<IconFileZip size={14} />} onClick={zip} disabled={!icons.length}>Download all (ZIP)</Button>}>
            <Group gap="md" align="flex-end" wrap="wrap">
              {icons.map((i) => (
                <Stack key={i.name} gap={4} align="center">
                  <Paper p={4} className="df-checker" radius="sm"><img src={i.url} alt={i.name} width={Math.min(96, i.size)} height={Math.min(96, i.size)} style={{ imageRendering: i.size < 64 ? 'pixelated' : 'auto', display: 'block' }} /></Paper>
                  <Text size="10px" c="dimmed">{i.mask ? 'maskable' : `${i.size}px`}</Text>
                </Stack>
              ))}
            </Group>
            <Paper mt="md" p="xs" radius="md" withBorder>
              <Group gap={8} wrap="nowrap">
                {icons[1] && <img src={icons[1].url} width={16} height={16} alt="" />}
                <Text size="xs" truncate>{safeName} — browser tab preview</Text>
              </Group>
            </Paper>
          </Panel>
          <Panel title="Add to your <head>"><Code block>{html}</Code></Panel>
        </Stack>
      </SimpleGrid>
      <PrivacyNote>Includes favicon.ico (16/32/48), Apple touch icon, Android/PWA icons, a maskable icon and site.webmanifest.</PrivacyNote>
    </Stack>
  );
}
