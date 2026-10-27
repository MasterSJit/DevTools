import { useEffect, useMemo, useState } from 'react';
import {
  Stack, Group, Text, Textarea, TextInput, PasswordInput, Select, SegmentedControl, ColorInput, Slider, SimpleGrid, Button, Switch, Paper, Alert, Tabs,
} from '@mantine/core';
import { IconDownload, IconQrcode, IconScan } from '@tabler/icons-react';
import QRCode from 'qrcode';
import CopyButton from '@/shared/components/CopyButton';
import FileDropZone from '@/shared/components/FileDropZone';
import { Panel, PrivacyNote } from '@/shared/components/ui';
import { downloadBlob } from '@/shared/lib/download';

const wifiEscape = (s) => s.replace(/([\\;,:"])/g, '\\$1');

function buildPayload(type, f) {
  switch (type) {
    case 'wifi': return `WIFI:T:${f.security};S:${wifiEscape(f.ssid)};${f.security !== 'nopass' ? `P:${wifiEscape(f.password)};` : ''}${f.hidden ? 'H:true;' : ''};`;
    case 'email': return `mailto:${f.email}?${new URLSearchParams({ subject: f.subject, body: f.body }).toString().replace(/\+/g, '%20')}`;
    case 'sms': return `SMSTO:${f.phone}:${f.body}`;
    case 'phone': return `tel:${f.phone}`;
    case 'vcard': return ['BEGIN:VCARD', 'VERSION:3.0', `N:${f.last};${f.first}`, `FN:${f.first} ${f.last}`, f.org && `ORG:${f.org}`, f.phone && `TEL:${f.phone}`, f.email && `EMAIL:${f.email}`, f.url && `URL:${f.url}`, 'END:VCARD'].filter(Boolean).join('\n');
    default: return f.text;
  }
}

function Generator() {
  const [type, setType] = useState('text');
  const [f, setF] = useState({ text: 'https://dev-tools.serversbay.com', ssid: '', password: '', security: 'WPA', hidden: false, email: '', subject: '', body: '', phone: '', first: '', last: '', org: '', url: '' });
  const [ecl, setEcl] = useState('M');
  const [size, setSize] = useState(320);
  const [dark, setDark] = useState('#0f172a');
  const [light, setLight] = useState('#ffffff');
  const [png, setPng] = useState('');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.currentTarget ? (e.currentTarget.type === 'checkbox' ? e.currentTarget.checked : e.currentTarget.value) : e }));
  const payload = useMemo(() => buildPayload(type, f), [type, f]);

  useEffect(() => {
    if (!payload) { setPng(''); setSvg(''); return; }
    const opts = { errorCorrectionLevel: ecl, margin: 2, width: size, color: { dark, light } };
    Promise.all([QRCode.toDataURL(payload, opts), QRCode.toString(payload, { ...opts, type: 'svg' })])
      .then(([p, s]) => { setPng(p); setSvg(s); setError(null); })
      .catch((e) => { setError(e.message); setPng(''); });
  }, [payload, ecl, size, dark, light]);

  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }}>
      <Panel title="Content" icon={IconQrcode}>
        <Stack gap="sm">
          <SegmentedControl value={type} onChange={setType} size="xs" fullWidth
            data={[{ value: 'text', label: 'Text / URL' }, { value: 'wifi', label: 'Wi-Fi' }, { value: 'email', label: 'E-mail' }, { value: 'sms', label: 'SMS' }, { value: 'phone', label: 'Phone' }, { value: 'vcard', label: 'Contact' }]} />
          {type === 'text' && <Textarea value={f.text} onChange={set('text')} autosize minRows={3} placeholder="Text or URL" />}
          {type === 'wifi' && (<>
            <TextInput label="Network name (SSID)" value={f.ssid} onChange={set('ssid')} />
            <Select label="Security" value={f.security} onChange={set('security')} allowDeselect={false} data={[{ value: 'WPA', label: 'WPA/WPA2/WPA3' }, { value: 'WEP', label: 'WEP' }, { value: 'nopass', label: 'None' }]} />
            {f.security !== 'nopass' && <PasswordInput label="Password" value={f.password} onChange={set('password')} />}
            <Switch label="Hidden network" checked={f.hidden} onChange={set('hidden')} />
          </>)}
          {type === 'email' && (<>
            <TextInput label="To" value={f.email} onChange={set('email')} />
            <TextInput label="Subject" value={f.subject} onChange={set('subject')} />
            <Textarea label="Body" value={f.body} onChange={set('body')} autosize minRows={2} />
          </>)}
          {(type === 'sms' || type === 'phone') && <TextInput label="Phone number" value={f.phone} onChange={set('phone')} placeholder="+91 98765 43210" />}
          {type === 'sms' && <Textarea label="Message" value={f.body} onChange={set('body')} autosize minRows={2} />}
          {type === 'vcard' && (
            <SimpleGrid cols={2} spacing="xs">
              <TextInput label="First name" value={f.first} onChange={set('first')} />
              <TextInput label="Last name" value={f.last} onChange={set('last')} />
              <TextInput label="Organization" value={f.org} onChange={set('org')} />
              <TextInput label="Phone" value={f.phone} onChange={set('phone')} />
              <TextInput label="E-mail" value={f.email} onChange={set('email')} />
              <TextInput label="Website" value={f.url} onChange={set('url')} />
            </SimpleGrid>
          )}
          <Group grow>
            <Select label="Error correction" value={ecl} onChange={setEcl} allowDeselect={false}
              data={[{ value: 'L', label: 'L — 7%' }, { value: 'M', label: 'M — 15%' }, { value: 'Q', label: 'Q — 25%' }, { value: 'H', label: 'H — 30%' }]} />
            <ColorInput label="Foreground" value={dark} onChange={setDark} />
            <ColorInput label="Background" value={light} onChange={setLight} />
          </Group>
          <div>
            <Text size="sm" mb={4}>Size: {size}px</Text>
            <Slider value={size} onChange={setSize} min={128} max={1024} step={32} />
          </div>
        </Stack>
      </Panel>
      <Panel title="QR code">
        {error && <Alert color="red" p="xs">{error}</Alert>}
        {png && (
          <Stack align="center" gap="sm">
            <Paper p="sm" bg={light}><img src={png} alt="QR code" style={{ width: Math.min(size, 320), height: Math.min(size, 320), imageRendering: 'pixelated' }} /></Paper>
            <Group>
              <Button leftSection={<IconDownload size={16} />} onClick={() => fetch(png).then((r) => r.blob()).then((b) => downloadBlob(b, 'qrcode.png'))}>PNG</Button>
              <Button variant="light" leftSection={<IconDownload size={16} />} onClick={() => downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qrcode.svg')}>SVG</Button>
              <CopyButton value={payload} />
            </Group>
            <Text size="xs" c="dimmed" ff="monospace" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{payload}</Text>
          </Stack>
        )}
      </Panel>
    </SimpleGrid>
  );
}

function Scanner() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const onFile = async (file) => {
    setError(null); setResult(null);
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(await createImageBitmap(file));
      if (!codes.length) throw new Error('No QR code found in this image.');
      setResult(codes.map((c) => c.rawValue));
    } catch (e) { setError(e.message); }
  };

  if (!supported) return <Alert color="orange">Your browser does not support the BarcodeDetector API (available in Chrome, Edge and Android). Try one of those to scan QR images.</Alert>;
  return (
    <Stack gap="md">
      <FileDropZone onFile={onFile} accept={{ 'image/*': [] }} title="Drop an image containing a QR code" />
      {error && <Alert color="red" p="xs">{error}</Alert>}
      {result?.map((r, i) => (
        <Panel key={i} title="Decoded content" actions={<CopyButton value={r} icon />}>
          <Text ff="monospace" size="sm" style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{r}</Text>
          {/^https?:/i.test(r) && <Text size="xs" c="orange" mt="xs">Contains a link — check it with the URL Analyzer before opening.</Text>}
        </Panel>
      ))}
    </Stack>
  );
}

export default function QrGenerator() {
  const [tab, setTab] = useState('gen');
  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="gen" leftSection={<IconQrcode size={14} />}>Generate</Tabs.Tab>
          <Tabs.Tab value="scan" leftSection={<IconScan size={14} />}>Scan from image</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'gen' ? <Generator /> : <Scanner />}
      <PrivacyNote />
    </Stack>
  );
}
