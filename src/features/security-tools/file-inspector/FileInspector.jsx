import { useMemo, useState } from 'react';
import {
  Stack, Group, Text, Badge, Tabs, Textarea, SimpleGrid, Button, Pagination, Tooltip, Anchor, NumberInput, Alert,
} from '@mantine/core';
import { IconFileSearch, IconExternalLink } from '@tabler/icons-react';
import FileDropZone from '@/shared/components/FileDropZone';
import CopyButton from '@/shared/components/CopyButton';
import { Panel, KVTable, FindingList, Stat, PrivacyNote } from '@/shared/components/ui';
import { digest, shannonEntropy } from '@/shared/lib/crypto';
import { bytesToHex, hexdump } from '@/shared/lib/encoding';
import { formatBytes } from '@/shared/lib/download';
import { detectType, parseExecutable, extractStrings, findIocs } from './signatures';

const PAGE = 1024;

function entropyBlocks(bytes, n = 64) {
  const size = Math.max(256, Math.ceil(bytes.length / n));
  const out = [];
  for (let i = 0; i < bytes.length; i += size) out.push(shannonEntropy(bytes.subarray(i, i + size)));
  return out;
}

function analyze(file, bytes, types) {
  const f = [];
  const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  const top = types[0];
  if (top && ext && !types.some((t) => t.exts.includes(ext))) {
    const exe = top.category === 'executable';
    f.push({
      level: exe ? 'critical' : 'medium',
      title: `Extension mismatch: “.${ext}” but content is ${top.name}`,
      detail: exe ? 'An executable disguised with another extension is a classic malware trick. Do not open it.' : 'The file extension does not match its real content.',
    });
  }
  if (/\.(pdf|docx?|xlsx?|jpg|png|txt)\.(exe|scr|js|vbs|bat|cmd|lnk|hta)$/i.test(file.name)) {
    f.push({ level: 'critical', title: 'Double extension', detail: `“${file.name}” hides its real executable extension.` });
  }
  if (top?.category === 'executable' || top?.category === 'script') f.push({ level: 'info', title: `${top.name}`, detail: 'Executable content — only run files from sources you trust.' });
  const ent = shannonEntropy(bytes);
  if (ent > 7.5 && !['image', 'archive', 'media', 'font'].includes(top?.category)) {
    f.push({ level: 'medium', title: `Very high entropy (${ent.toFixed(2)} bits/byte)`, detail: 'Data looks compressed or encrypted. Inside executables this often means packing/obfuscation.' });
  }
  if (!types.length) f.push({ level: 'low', title: 'Unknown file type', detail: 'No known signature matched.' });
  if (!f.length) f.push({ level: 'pass', title: 'Nothing suspicious about type/extension' });
  return f;
}

export default function FileInspector() {
  const [file, setFile] = useState(null);
  const [bytes, setBytes] = useState(null);
  const [hashes, setHashes] = useState({});
  const [page, setPage] = useState(1);
  const [minLen, setMinLen] = useState(5);
  const [tab, setTab] = useState('overview');

  const onFile = async (f) => {
    const b = new Uint8Array(await f.arrayBuffer());
    setFile(f); setBytes(b); setPage(1); setTab('overview'); setHashes({});
    const out = {};
    for (const algo of ['MD5', 'SHA-1', 'SHA-256']) out[algo] = bytesToHex(await digest(algo, b));
    setHashes(out);
  };

  const types = useMemo(() => (bytes ? detectType(bytes) : []), [bytes]);
  const exec = useMemo(() => (bytes ? parseExecutable(bytes) : null), [bytes]);
  const entropy = useMemo(() => (bytes ? shannonEntropy(bytes) : 0), [bytes]);
  const blocks = useMemo(() => (bytes ? entropyBlocks(bytes) : []), [bytes]);
  const strings = useMemo(() => (bytes ? extractStrings(bytes, minLen) : []), [bytes, minLen]);
  const iocs = useMemo(() => findIocs(strings), [strings]);
  const findings = useMemo(() => (file && bytes ? analyze(file, bytes, types) : []), [file, bytes, types]);

  if (!bytes) {
    return (
      <Stack gap="md">
        <FileDropZone onFile={onFile} title="Drop any file to inspect — nothing is uploaded" maxSize={1024 * 1024 * 1024} height={180} />
        <PrivacyNote>Detects the real file type from magic bytes, shows a hex dump, entropy, embedded strings/IOCs and hashes — fully offline.</PrivacyNote>
      </Stack>
    );
  }

  const pages = Math.ceil(bytes.length / PAGE);
  const iocCount = Object.values(iocs).reduce((n, a) => n + a.length, 0);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <IconFileSearch size={18} />
          <Text fw={600}>{file.name}</Text>
          <Badge variant="light">{formatBytes(file.size)}</Badge>
          {file.type && <Badge variant="outline" color="gray" tt="none">{file.type}</Badge>}
        </Group>
        <Button size="xs" variant="subtle" onClick={() => { setFile(null); setBytes(null); }}>Inspect another file</Button>
      </Group>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="hex">Hex dump</Tabs.Tab>
          <Tabs.Tab value="strings">Strings ({strings.length})</Tabs.Tab>
          <Tabs.Tab value="iocs">IOCs ({iocCount})</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {tab === 'overview' && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <Stat label="Detected type" value={types[0]?.name.split(' (')[0] || 'Unknown'} />
            <Stat label="Size" value={formatBytes(bytes.length)} />
            <Stat label="Entropy" value={`${entropy.toFixed(3)} / 8`} color={entropy > 7.5 ? 'orange' : undefined} />
            <Stat label="First bytes" value={bytesToHex(bytes.subarray(0, 8), ' ')} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Panel title="Security review">
              <FindingList findings={findings} />
              {types.length > 1 && <Text size="xs" c="dimmed" mt="xs">Other signature matches: {types.slice(1).map((t) => t.name).join(', ')}</Text>}
            </Panel>
            <Panel title="Hashes" actions={hashes['SHA-256'] && (
              <Anchor size="xs" href={`https://www.virustotal.com/gui/file/${hashes['SHA-256']}`} target="_blank" rel="noopener noreferrer">
                Look up on VirusTotal <IconExternalLink size={11} />
              </Anchor>
            )}>
              <KVTable labelWidth={80} rows={Object.entries(hashes).map(([k, v]) => [k, v])} />
              <Text size="xs" c="dimmed" mt={4}>The VirusTotal link only sends the hash (when you click it), never the file.</Text>
            </Panel>
          </SimpleGrid>
          {exec && (
            <Panel title={`Executable header — ${exec.format}`}>
              <KVTable rows={Object.entries(exec).filter(([k]) => k !== 'format').map(([k, v]) => [k, String(v), { copy: false }])} />
            </Panel>
          )}
          <Panel title="Entropy by region">
            <div className="flex items-end gap-[2px] h-20">
              {blocks.map((e, i) => (
                <Tooltip key={i} label={`Block ${i + 1}: ${e.toFixed(2)} bits/byte`}>
                  <div className="flex-1 rounded-t-sm" style={{
                    height: `${(e / 8) * 100}%`,
                    minHeight: 2,
                    background: e > 7.5 ? 'var(--mantine-color-orange-5)' : e > 6 ? 'var(--mantine-color-yellow-5)' : 'var(--mantine-color-indigo-5)',
                  }} />
                </Tooltip>
              ))}
            </div>
            <Text size="xs" c="dimmed" mt={6}>Low (&lt;6): text/code · Medium: mixed data · High (&gt;7.5): compressed or encrypted.</Text>
          </Panel>
        </Stack>
      )}

      {tab === 'hex' && (
        <Panel title={`Offset 0x${((page - 1) * PAGE).toString(16)} – 0x${Math.min(bytes.length, page * PAGE).toString(16)}`}
          actions={<CopyButton value={hexdump(bytes.subarray((page - 1) * PAGE, page * PAGE), (page - 1) * PAGE)} icon />}>
          <Textarea readOnly value={hexdump(bytes.subarray((page - 1) * PAGE, page * PAGE), (page - 1) * PAGE)}
            autosize minRows={10} maxRows={30} className="code-font" styles={{ input: { fontSize: 12, whiteSpace: 'pre', overflowX: 'auto' } }} />
          {pages > 1 && <Group justify="center" mt="sm"><Pagination size="sm" total={pages} value={page} onChange={setPage} siblings={1} /></Group>}
        </Panel>
      )}

      {tab === 'strings' && (
        <Panel title="Printable ASCII strings" actions={<>
          <NumberInput size="xs" w={110} value={minLen} onChange={(v) => setMinLen(Math.max(3, Number(v) || 5))} min={3} max={50} prefix="min " />
          <CopyButton value={strings.join('\n')} icon />
        </>}>
          <Textarea readOnly value={strings.join('\n')} autosize minRows={10} maxRows={30} className="code-font" />
          {strings.length >= 3000 && <Text size="xs" c="dimmed" mt={4}>Showing the first 3000 strings.</Text>}
        </Panel>
      )}

      {tab === 'iocs' && (
        <Stack gap="md">
          {iocCount === 0 && <Alert color="gray">No URLs, IPs, e-mails, paths, registry keys or secrets found in the strings.</Alert>}
          {Object.entries(iocs).map(([type, list]) => (
            <Panel key={type} title={`${type} (${list.length})`} actions={<CopyButton value={list.join('\n')} icon />}>
              <Stack gap={2}>{list.map((v) => <Text key={v} size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>{v}</Text>)}</Stack>
            </Panel>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
