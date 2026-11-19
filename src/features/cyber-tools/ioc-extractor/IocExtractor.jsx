import { useMemo, useState } from 'react';
import { Stack, SimpleGrid, Group, Switch, Badge, Paper, Text, Button, SegmentedControl, Textarea } from '@mantine/core';
import { InputArea, OutputArea, Stat, PrivacyNote } from '@/shared/components/ui';
import CopyButton from '@/shared/components/CopyButton';

/** Turn defanged indicators back into real ones (hxxp, [.], (dot), [at]…). */
export const refang = (s) => s
  .replace(/h[x*]{2}p(s?)/gi, 'http$1')
  .replace(/\[(\.|dot)\]|\((\.|dot)\)|\{(\.|dot)\}|\s+dot\s+/gi, '.')
  .replace(/\[(@|at)\]|\((@|at)\)|\s+at\s+(?=[\w-]+\[?\.)/gi, '@')
  .replace(/\[:\]/g, ':')
  .replace(/\[\/\]/g, '/');

/** Make indicators safe to paste into tickets / chats (unclickable). */
export const defang = (s) => s.replace(/https?/gi, (m) => m.replace(/t/gi, 'x')).replace(/\./g, '[.]').replace(/@/g, '[@]');

const TLDS = 'com|net|org|io|co|in|ru|cn|info|biz|xyz|top|online|site|club|me|us|uk|de|fr|br|jp|kr|tk|ml|ga|cf|gq|pw|cc|ws|su|onion|gov|edu|mil|app|dev|ai|ly|to|sh|tv|live|shop|store|cloud|tech|link|click|zip|mov';

const PATTERNS = {
  url: { label: 'URLs', re: /\bhttps?:\/\/[^\s"'<>()[\]{}]+/gi },
  domain: { label: 'Domains', re: new RegExp(`\\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:${TLDS})\\b`, 'gi') },
  ipv4: { label: 'IPv4', re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
  ipv6: { label: 'IPv6', re: /\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b|\b(?:[0-9a-f]{1,4}:){1,7}:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4}\b/gi },
  email: { label: 'Emails', re: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi },
  md5: { label: 'MD5', re: /\b[a-f0-9]{32}\b/gi },
  sha1: { label: 'SHA-1', re: /\b[a-f0-9]{40}\b/gi },
  sha256: { label: 'SHA-256', re: /\b[a-f0-9]{64}\b/gi },
  sha512: { label: 'SHA-512', re: /\b[a-f0-9]{128}\b/gi },
  cve: { label: 'CVEs', re: /\bCVE-\d{4}-\d{4,7}\b/gi },
  mitre: { label: 'MITRE ATT&CK', re: /\bT\d{4}(?:\.\d{3})?\b/g },
  btc: { label: 'Bitcoin addresses', re: /\b(?:bc1[a-z0-9]{25,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g },
  path: { label: 'Windows paths', re: /\b[a-z]:\\(?:[^\\/:*?"<>|\r\n\s]+\\)*[^\\/:*?"<>|\r\n\s]*/gi },
  registry: { label: 'Registry keys', re: /\b(?:HKLM|HKCU|HKEY_LOCAL_MACHINE|HKEY_CURRENT_USER|HKCR|HKU)\\[^\s"']+/g },
};

const isPrivateIp = (ip) => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|22[4-9]\.|2[3-5]\d\.)/.test(ip);

const SAMPLE = `Alert 4471: beacon from 10.0.4.23 to hxxps://update-micros0ft[.]com/api/v2/check?id=88 (resolves 185.220.101[.]45)
Dropper SHA256 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08, MD5 098f6bcd4621d373cade4e832627b4f6
Persistence: HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\Updater -> C:\\Users\\Public\\svch0st.exe
Phish sent from billing[@]paypa1-secure[.]xyz exploiting CVE-2023-23397, technique T1566.001. Ransom to bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq`;

export default function IocExtractor() {
  const [input, setInput] = useState(SAMPLE);
  const [doRefang, setDoRefang] = useState(true);
  const [skipPrivate, setSkipPrivate] = useState(true);
  const [outFmt, setOutFmt] = useState('defanged');

  const result = useMemo(() => {
    const text = doRefang ? refang(input) : input;
    const found = {};
    for (const [k, p] of Object.entries(PATTERNS)) {
      let list = [...new Set((text.match(p.re) || []).map((x) => x.replace(/[.,;:]+$/, '')))];
      if (k === 'ipv4' && skipPrivate) list = list.filter((ip) => !isPrivateIp(ip));
      if (k === 'domain') list = list.filter((d) => !/\.(exe|dll|ps1|js)$/i.test(d));
      if (list.length) found[k] = list;
    }
    return found;
  }, [input, doRefang, skipPrivate]);

  const fmt = (v) => (outFmt === 'defanged' ? defang(v) : v);
  const total = Object.values(result).reduce((n, l) => n + l.length, 0);
  const asText = Object.entries(result).map(([k, l]) => `# ${PATTERNS[k].label}\n${l.map(fmt).join('\n')}`).join('\n\n');
  const asCsv = ['type,value', ...Object.entries(result).flatMap(([k, l]) => l.map((v) => `${k},"${fmt(v).replace(/"/g, '""')}"`))].join('\n');

  return (
    <Stack gap="md">
      <InputArea label="Logs, threat report, email headers, alert text…" value={input} onChange={setInput} minRows={6} maxRows={14}
        actions={<Button size="compact-xs" variant="subtle" onClick={() => setInput(SAMPLE)}>Sample</Button>} />
      <Group>
        <Switch label="Refang input (hxxp, [.], [@])" checked={doRefang} onChange={(e) => setDoRefang(e.currentTarget.checked)} />
        <Switch label="Ignore private / reserved IPs" checked={skipPrivate} onChange={(e) => setSkipPrivate(e.currentTarget.checked)} />
        <SegmentedControl size="xs" value={outFmt} onChange={setOutFmt} data={[{ value: 'defanged', label: 'Defanged output' }, { value: 'raw', label: 'Raw output' }]} />
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Stat label="Indicators" value={total} />
        <Stat label="Network" value={(result.url?.length || 0) + (result.domain?.length || 0) + (result.ipv4?.length || 0) + (result.ipv6?.length || 0)} />
        <Stat label="Hashes" value={['md5', 'sha1', 'sha256', 'sha512'].reduce((n, k) => n + (result[k]?.length || 0), 0)} />
        <Stat label="CVEs / TTPs" value={(result.cve?.length || 0) + (result.mitre?.length || 0)} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="sm">
        {Object.entries(result).map(([k, list]) => (
          <Paper key={k} p="xs">
            <Group justify="space-between" mb={4}>
              <Group gap={6}><Text size="sm" fw={600}>{PATTERNS[k].label}</Text><Badge size="xs" variant="light">{list.length}</Badge></Group>
              <CopyButton value={list.map(fmt).join('\n')} icon />
            </Group>
            <Textarea value={list.map(fmt).join('\n')} readOnly autosize minRows={1} maxRows={8} className="code-font" size="xs" />
          </Paper>
        ))}
      </SimpleGrid>
      {total === 0 && <Text size="sm" c="dimmed">No indicators found.</Text>}
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <OutputArea label="All indicators (grouped)" value={asText} minRows={4} filename="iocs.txt" />
        <OutputArea label="CSV" value={asCsv} minRows={4} filename="iocs.csv" mimeType="text/csv" />
      </SimpleGrid>
      <PrivacyNote>Extraction runs locally — safe for sensitive incident data. Defanged output is safe to paste into tickets and chats.</PrivacyNote>
    </Stack>
  );
}
