import { useState } from 'react';
import { Stack, Group, Text, Badge, Button, SimpleGrid, Table, ScrollArea, Anchor, Alert, TextInput } from '@mantine/core';
import { IconEraser, IconMapPin, IconPhotoShield } from '@tabler/icons-react';
import exifr from 'exifr';
import FileDropZone from '@/shared/components/FileDropZone';
import ImagePreview from '@/shared/components/ImagePreview';
import { Panel, FindingList, PrivacyNote } from '@/shared/components/ui';
import { downloadBlob, formatBytes } from '@/shared/lib/download';
import { concatBytes } from '@/shared/lib/encoding';

const SERIAL_KEYS = /serial|uniqueid|ownername|cameraowner|imageuniqueid/i;

function findings(meta, gps) {
  const f = [];
  if (gps) f.push({ level: 'high', title: 'GPS location embedded', detail: `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)} — reveals where the photo was taken (e.g. your home).` });
  const serials = Object.keys(meta).filter((k) => SERIAL_KEYS.test(k));
  if (serials.length) f.push({ level: 'medium', title: 'Device serial / owner identifiers', detail: `${serials.join(', ')} can link photos to the same device or person.` });
  if (meta.Make || meta.Model) f.push({ level: 'low', title: 'Camera / phone model', detail: `${meta.Make || ''} ${meta.Model || ''}`.trim() });
  if (meta.DateTimeOriginal || meta.CreateDate) f.push({ level: 'low', title: 'Original capture time', detail: String(meta.DateTimeOriginal || meta.CreateDate) });
  if (meta.Software) f.push({ level: 'info', title: 'Editing software', detail: String(meta.Software) });
  if (meta.Artist || meta.Copyright || meta.creator) f.push({ level: 'info', title: 'Author / copyright', detail: [meta.Artist, meta.Copyright, meta.creator].filter(Boolean).join(' · ') });
  if (!f.length) f.push({ level: 'pass', title: 'No privacy-sensitive metadata found' });
  return f;
}

// Lossless JPEG strip: drop APP1 (EXIF/XMP), APP13 (IPTC/Photoshop) and COM segments; keep everything else.
function stripJpeg(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const parts = [bytes.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xda) { parts.push(bytes.subarray(i)); break; } // start of scan → rest is image data
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    const seg = bytes.subarray(i, i + 2 + len);
    if (!(marker === 0xe1 || marker === 0xed || marker === 0xfe)) parts.push(seg);
    i += 2 + len;
  }
  return concatBytes(...parts);
}

// Lossless PNG strip: drop textual / EXIF / time chunks.
function stripPng(bytes) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!sig.every((b, i) => bytes[i] === b)) return null;
  const drop = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);
  const parts = [bytes.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= bytes.length) {
    const len = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
    const type = String.fromCharCode(...bytes.subarray(i + 4, i + 8));
    const chunk = bytes.subarray(i, i + 12 + len);
    if (!drop.has(type)) parts.push(chunk);
    i += 12 + len;
    if (type === 'IEND') break;
  }
  return concatBytes(...parts);
}

function reencode(url, type) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not re-encode image'))), type, 0.95);
    };
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = url;
  });
}

const fmtVal = (v) => (v instanceof Date ? v.toISOString() : Array.isArray(v) || ArrayBuffer.isView(v) ? `[${Array.from(v).slice(0, 12).join(', ')}${v.length > 12 ? '…' : ''}]` : typeof v === 'object' ? JSON.stringify(v) : String(v));

export default function MetadataPrivacy() {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState(null);
  const [meta, setMeta] = useState(null);
  const [gps, setGps] = useState(null);
  const [filter, setFilter] = useState('');
  const [stripped, setStripped] = useState(null);
  const [error, setError] = useState(null);

  const onFile = async (f) => {
    setFile(f); setUrl(URL.createObjectURL(f)); setStripped(null); setError(null);
    try {
      const [all, g] = await Promise.all([
        exifr.parse(f, { tiff: true, exif: true, gps: true, iptc: true, xmp: true, icc: false, interop: true, translateValues: true, mergeOutput: true }),
        exifr.gps(f).catch(() => null),
      ]);
      setMeta(all || {});
      setGps(g && Number.isFinite(g.latitude) ? g : null);
    } catch (e) { setMeta({}); setGps(null); setError(`Could not read metadata: ${e.message}`); }
  };

  const strip = async () => {
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let out = stripJpeg(bytes) || stripPng(bytes);
      let method = 'lossless';
      let blob;
      if (out) blob = new Blob([out], { type: file.type });
      else { blob = await reencode(url, file.type === 'image/png' ? 'image/png' : 'image/jpeg'); method = 're-encoded'; }
      const remaining = await exifr.parse(blob).catch(() => null);
      setStripped({ blob, method, remaining: remaining ? Object.keys(remaining).length : 0 });
    } catch (e) { setError(e.message); }
  };

  const rows = meta ? Object.entries(meta).filter(([k, v]) => v != null && (k + fmtVal(v)).toLowerCase().includes(filter.toLowerCase())) : [];

  if (!file) {
    return (
      <Stack gap="md">
        <FileDropZone onFile={onFile} accept={{ 'image/*': [] }} title="Drop a photo to check what it reveals about you" height={160} />
        <PrivacyNote>Reads EXIF, GPS, IPTC and XMP locally. Stripping JPEG/PNG metadata is lossless — pixels are untouched.</PrivacyNote>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title={file.name} icon={IconPhotoShield} actions={<Button size="compact-xs" variant="subtle" onClick={() => { setFile(null); setMeta(null); }}>Another image</Button>}>
          <ImagePreview src={url} maxHeight={260} />
          <Group gap="xs" mt="xs" justify="center">
            <Badge variant="light">{formatBytes(file.size)}</Badge>
            <Badge variant="light" color="gray">{rows.length} metadata fields</Badge>
          </Group>
        </Panel>
        <Panel title="Privacy review">
          <FindingList findings={meta ? findings(meta, gps) : []} />
          {gps && (
            <Anchor size="sm" href={`https://www.openstreetmap.org/?mlat=${gps.latitude}&mlon=${gps.longitude}#map=16/${gps.latitude}/${gps.longitude}`}
              target="_blank" rel="noopener noreferrer" mt="xs" display="inline-flex" style={{ alignItems: 'center', gap: 4 }}>
              <IconMapPin size={14} /> Show location on OpenStreetMap
            </Anchor>
          )}
          <Group mt="md">
            <Button leftSection={<IconEraser size={16} />} onClick={strip} color="red" variant="light">Remove metadata</Button>
            {stripped && (
              <Button variant="filled" onClick={() => downloadBlob(stripped.blob, `clean_${file.name}`)}>
                Download clean image ({formatBytes(stripped.blob.size)})
              </Button>
            )}
          </Group>
          {stripped && (
            <Text size="xs" c="dimmed" mt="xs">
              {stripped.method === 'lossless'
                ? 'Lossless strip — image data untouched. The EXIF orientation flag is removed too, so some phone photos may display rotated.'
                : 'Re-encoded via canvas (format had no lossless stripper).'}{' '}
              Remaining metadata fields: {stripped.remaining}.
            </Text>
          )}
          {error && <Alert color="red" p="xs" mt="xs">{error}</Alert>}
        </Panel>
      </SimpleGrid>

      <Panel title="All metadata" actions={<TextInput size="xs" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.currentTarget.value)} />}>
        {rows.length ? (
          <ScrollArea.Autosize mah={420}>
            <Table striped verticalSpacing={4}>
              <Table.Tbody>
                {rows.map(([k, v]) => (
                  <Table.Tr key={k} className={SERIAL_KEYS.test(k) || /gps|latitude|longitude/i.test(k) ? 'bg-red-500/5' : ''}>
                    <Table.Td w={220}><Text size="xs" fw={500}>{k}</Text></Table.Td>
                    <Table.Td><Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>{fmtVal(v)}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
        ) : <Text size="sm" c="dimmed">No metadata found.</Text>}
      </Panel>
    </Stack>
  );
}
