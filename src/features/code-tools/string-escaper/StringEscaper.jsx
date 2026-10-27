import { useMemo, useState } from 'react';
import { Stack, Group, SegmentedControl, Select, Text, SimpleGrid, Alert, Button } from '@mantine/core';
import { IconArrowsExchange } from '@tabler/icons-react';
import { InputArea, OutputArea } from '@/shared/components/ui';

const HTML_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;' };

const decodeHtml = (s) => {
  const t = document.createElement('textarea');
  t.innerHTML = s;
  return t.value;
};

const MODES = {
  html: {
    label: 'HTML entities',
    note: 'Escapes characters that break out of HTML text and attribute contexts (OWASP rule #1/#2).',
    escape: (s) => s.replace(/[&<>"'/`=]/g, (c) => HTML_MAP[c]),
    unescape: decodeHtml,
  },
  'html-all': {
    label: 'HTML (all non-ASCII as &#…;)',
    escape: (s) => Array.from(s).map((c) => (HTML_MAP[c] || (c.codePointAt(0) > 126 ? `&#${c.codePointAt(0)};` : c))).join(''),
    unescape: decodeHtml,
  },
  js: {
    label: 'JavaScript string',
    escape: (s) => s.replace(/[\\'"`\n\r\t\b\f\v\0\u2028\u2029<]/g, (c) => ({
      '\\': '\\\\', "'": "\\'", '"': '\\"', '`': '\\`', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f', '\v': '\\v', '\0': '\\0',
      '\u2028': '\\u2028', '\u2029': '\\u2029', '<': '\\x3C',
    }[c])),
    unescape: (s) => s.replace(/\\(u\{[0-9a-f]+\}|u[0-9a-f]{4}|x[0-9a-f]{2}|[0-7]{1,3}|.)/gi, (_, e) => {
      if (/^u\{/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2, -1), 16));
      if (/^[ux]/i.test(e) && e.length > 1) return String.fromCharCode(parseInt(e.slice(1), 16));
      if (/^[0-7]+$/.test(e)) return String.fromCharCode(parseInt(e, 8));
      return { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v' }[e] ?? e;
    }),
  },
  json: {
    label: 'JSON string',
    escape: (s) => JSON.stringify(s).slice(1, -1),
    unescape: (s) => JSON.parse(`"${s.replace(/^"|"$/g, '')}"`),
  },
  url: { label: 'URL component', escape: encodeURIComponent, unescape: (s) => decodeURIComponent(s.replace(/\+/g, ' ')) },
  sql: {
    label: 'SQL string literal',
    note: 'Only for quick scripts — in application code always use parameterized queries / prepared statements.',
    escape: (s) => `'${s.replace(/'/g, "''").replace(/\\/g, '\\\\').replace(/\0/g, '\\0')}'`,
    unescape: (s) => s.replace(/^'|'$/g, '').replace(/''/g, "'").replace(/\\\\/g, '\\'),
  },
  shell: {
    label: 'POSIX shell argument',
    note: 'Wraps in single quotes — safe for sh/bash/zsh. Prefer passing argument arrays (execve) over building shell strings.',
    escape: (s) => `'${s.replace(/'/g, `'\\''`)}'`,
    unescape: (s) => s.replace(/^'|'$/g, '').replace(/'\\''/g, "'"),
  },
  regex: { label: 'Regular expression literal', escape: (s) => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&'), unescape: (s) => s.replace(/\\(.)/g, '$1') },
  csv: {
    label: 'CSV field',
    escape: (s) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s),
    unescape: (s) => (/^".*"$/s.test(s) ? s.slice(1, -1).replace(/""/g, '"') : s),
  },
  xml: {
    label: 'XML',
    escape: (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])),
    unescape: (s) => s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[e.toLowerCase()]
      ?? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)))),
  },
  unicode: {
    label: 'Unicode escapes (\\uXXXX)',
    escape: (s) => Array.from(s).map((c) => {
      const cp = c.codePointAt(0);
      return cp < 128 ? c : cp > 0xffff ? `\\u{${cp.toString(16).toUpperCase()}}` : `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`;
    }).join(''),
    unescape: (s) => s.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})/gi, (_, a, b) => String.fromCodePoint(parseInt(a || b, 16))),
  },
  codepoints: {
    label: 'Code points (U+XXXX)',
    escape: (s) => Array.from(s).map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' '),
    unescape: (s) => (s.match(/U\+[0-9a-f]+/gi) || []).map((u) => String.fromCodePoint(parseInt(u.slice(2), 16))).join(''),
  },
};

export default function StringEscaper() {
  const [mode, setMode] = useState('html');
  const [dir, setDir] = useState('escape');
  const [input, setInput] = useState(`<script>alert("Hi, it's me & you")</script>`);

  const result = useMemo(() => {
    try { return { value: MODES[mode][dir](input) }; } catch (e) { return { error: e.message }; }
  }, [mode, dir, input]);

  return (
    <Stack gap="md">
      <Group>
        <Select value={mode} onChange={setMode} allowDeselect={false} w={280} searchable
          data={Object.entries(MODES).map(([value, m]) => ({ value, label: m.label }))} />
        <SegmentedControl value={dir} onChange={setDir} data={[{ value: 'escape', label: 'Escape' }, { value: 'unescape', label: 'Unescape' }]} />
        <Button variant="light" size="xs" leftSection={<IconArrowsExchange size={14} />} disabled={!result.value}
          onClick={() => { setInput(result.value); setDir(dir === 'escape' ? 'unescape' : 'escape'); }}>
          Swap
        </Button>
      </Group>
      {MODES[mode].note && <Text size="xs" c="dimmed">{MODES[mode].note}</Text>}
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <InputArea value={input} onChange={setInput} minRows={8} />
        <OutputArea value={result.value || ''} minRows={8} />
      </SimpleGrid>
      {result.error && <Alert color="red" p="xs">{result.error}</Alert>}
    </Stack>
  );
}
