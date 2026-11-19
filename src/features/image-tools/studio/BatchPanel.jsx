import { useRef, useState } from 'react';
import { Badge, Button, Group, NumberInput, Paper, Progress, SegmentedControl, Slider, Stack, Switch, Table, Text, ActionIcon, Tooltip } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconDownload, IconFileZip, IconStack2, IconTrash, IconX } from '@tabler/icons-react';
import { downloadBlob, formatBytes } from '@/shared/lib/download';
import { FORMATS, defaultsFor } from './codecs';
import { encodeOnce } from './encoderClient';

const MAX_FILES = 200;
const MAX_FILE = 100 * 1024 * 1024;

/** Compress many images with the same settings, sequentially, then download individually or as a ZIP. */
export default function BatchPanel() {
  const [items, setItems] = useState([]); // { id, file, status, out?, err? }
  const [fmt, setFmt] = useState('webp');
  const [quality, setQuality] = useState(75);
  const [limit, setLimit] = useState(false);
  const [maxSide, setMaxSide] = useState(1920);
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);

  const add = (files) => {
    setItems((cur) => [...cur, ...files.slice(0, MAX_FILES - cur.length).map((file) => ({ id: crypto.randomUUID(), file, status: 'queued' }))]);
  };
  const patch = (id, p) => setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const run = async () => {
    setRunning(true); stopRef.current = false;
    const def = FORMATS[fmt];
    const settings = { ...defaultsFor(fmt), ...(def.fields.some((f) => f.key === 'quality') ? { quality } : {}) };
    for (const it of items) {
      if (stopRef.current) break;
      if (it.status === 'done') continue;
      patch(it.id, { status: 'working', err: null });
      try {
        const bmp = await createImageBitmap(it.file, { imageOrientation: 'from-image' });
        const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (def.opaque) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(bmp, 0, 0); bmp.close?.();
        let resize = null;
        const long = Math.max(c.width, c.height);
        if (limit && long > maxSide) {
          const k = maxSide / long;
          resize = { width: Math.round(c.width * k), height: Math.round(c.height * k), method: 'lanczos3' };
        }
        const out = await encodeOnce(ctx.getImageData(0, 0, c.width, c.height), { format: fmt, mime: def.mime, options: def.toOptions(settings), resize });
        patch(it.id, { status: 'done', out: { ...out, ext: def.ext } });
      } catch (e) {
        patch(it.id, { status: 'error', err: e.message });
      }
    }
    setRunning(false);
  };

  const nameFor = (it) => `${it.file.name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').slice(0, 80)}.${it.out.ext}`;

  const zipAll = async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const used = new Set();
    items.filter((i) => i.out).forEach((it) => {
      let n = nameFor(it); let k = 1;
      while (used.has(n)) n = n.replace(/(\.\w+)$/, `-${k++}$1`);
      used.add(n); zip.file(n, it.out.blob);
    });
    downloadBlob(await zip.generateAsync({ type: 'blob' }), 'devforge-images.zip');
  };

  const done = items.filter((i) => i.status === 'done');
  const before = done.reduce((n, i) => n + i.file.size, 0);
  const after = done.reduce((n, i) => n + i.out.blob.size, 0);

  return (
    <Stack gap="md">
      <Dropzone onDrop={add} accept={['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'image/bmp']} maxSize={MAX_FILE} multiple radius="lg" disabled={running}>
        <Group justify="center" gap="md" py="lg" style={{ pointerEvents: 'none' }}>
          <IconStack2 size={36} stroke={1.5} />
          <div><Text fw={600}>Drop many images</Text><Text size="xs" c="dimmed">Up to {MAX_FILES} files, compressed one after another in a background worker</Text></div>
        </Group>
      </Dropzone>

      <Paper p="md" radius="lg" withBorder>
        <Group align="flex-end" gap="lg" wrap="wrap">
          <div>
            <Text size="xs" fw={600} c="dimmed" mb={4}>FORMAT</Text>
            <SegmentedControl value={fmt} onChange={setFmt} disabled={running}
              data={['webp', 'avif', 'jpeg', 'png'].map((k) => ({ value: k, label: FORMATS[k].label }))} />
          </div>
          {fmt !== 'png' && (
            <div style={{ width: 200 }}>
              <Text size="xs" fw={600} c="dimmed" mb={4}>QUALITY · {quality}</Text>
              <Slider value={quality} onChange={setQuality} min={1} max={100} disabled={running} />
            </div>
          )}
          <Group gap="xs" align="flex-end">
            <Switch label="Limit longest side" checked={limit} onChange={(e) => setLimit(e.currentTarget.checked)} disabled={running} />
            <NumberInput size="xs" w={90} value={maxSide} onChange={(v) => setMaxSide(Number(v) || 1920)} min={16} max={16384} disabled={!limit || running} suffix=" px" />
          </Group>
          <Group gap="xs" ml="auto">
            {running
              ? <Button color="red" variant="light" onClick={() => { stopRef.current = true; }}>Stop</Button>
              : <Button color="violet" onClick={run} disabled={!items.some((i) => i.status !== 'done')}>Compress {items.filter((i) => i.status !== 'done').length || ''}</Button>}
            <Button variant="default" leftSection={<IconFileZip size={16} />} disabled={!done.length || running} onClick={zipAll}>ZIP</Button>
            <Button variant="subtle" color="red" disabled={running || !items.length} onClick={() => setItems([])}>Clear</Button>
          </Group>
        </Group>
        {done.length > 0 && (
          <Group mt="sm" gap="xs">
            <Badge variant="light" color="teal" size="lg" radius="sm">{formatBytes(before)} → {formatBytes(after)} (−{Math.round((1 - after / before) * 100)}%)</Badge>
            <Text size="xs" c="dimmed">{done.length}/{items.length} done</Text>
          </Group>
        )}
        {running && <Progress mt="sm" value={(items.filter((i) => ['done', 'error'].includes(i.status)).length / items.length) * 100} striped animated color="violet" />}
      </Paper>

      {items.length > 0 && (
        <Table.ScrollContainer minWidth={560}>
          <Table verticalSpacing={6} highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>File</Table.Th><Table.Th>Original</Table.Th><Table.Th>Output</Table.Th><Table.Th>Saved</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>
              {items.map((it) => (
                <Table.Tr key={it.id}>
                  <Table.Td><Text size="sm" truncate maw={260}>{it.file.name}</Text></Table.Td>
                  <Table.Td><Text size="xs">{formatBytes(it.file.size)}</Text></Table.Td>
                  <Table.Td>
                    {it.status === 'done' && <Text size="xs">{formatBytes(it.out.blob.size)} · {it.out.width}×{it.out.height}</Text>}
                    {it.status === 'working' && <Badge size="xs" variant="light" color="violet">encoding…</Badge>}
                    {it.status === 'queued' && <Badge size="xs" variant="default">queued</Badge>}
                    {it.status === 'error' && <Tooltip label={it.err}><Badge size="xs" color="red" variant="light" leftSection={<IconX size={10} />}>failed</Badge></Tooltip>}
                  </Table.Td>
                  <Table.Td>{it.out && <Text size="xs" c={it.out.blob.size < it.file.size ? 'teal' : 'orange'} fw={600}>{Math.round((1 - it.out.blob.size / it.file.size) * 100)}%</Text>}</Table.Td>
                  <Table.Td>
                    <Group gap={2} justify="flex-end" wrap="nowrap">
                      {it.out && <ActionIcon variant="subtle" size="sm" aria-label="Download" onClick={() => downloadBlob(it.out.blob, nameFor(it))}><IconDownload size={14} /></ActionIcon>}
                      <ActionIcon variant="subtle" color="red" size="sm" aria-label="Remove" disabled={running} onClick={() => setItems((c) => c.filter((x) => x.id !== it.id))}><IconTrash size={14} /></ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}
