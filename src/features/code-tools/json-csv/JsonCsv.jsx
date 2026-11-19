import { useMemo, useState } from 'react';
import { Stack, SimpleGrid, SegmentedControl, Group, Switch, Select, Text, Alert, Table, Badge, Button } from '@mantine/core';
import { InputArea, OutputArea, PrivacyNote } from '@/shared/components/ui';

/* ── CSV (RFC 4180) ── */
export function parseCsv(text, delim) {
  const rows = []; let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"' && field === '') q = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (q) throw new Error('Unterminated quoted field');
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

const detectDelim = (text) => {
  const line = text.split(/\r?\n/, 1)[0] || '';
  return [',', ';', '\t', '|'].map((d) => [d, line.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
};

const infer = (v) => {
  if (v === '') return null;
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(v) && v.length < 16) return Number(v);
  return v;
};

function unflatten(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const parts = k.split('.');
    let cur = out;
    parts.forEach((p, i) => {
      if (['__proto__', 'constructor', 'prototype'].includes(p)) return; // prototype-pollution guard
      if (i === parts.length - 1) cur[p] = v;
      else { cur[p] = cur[p] && typeof cur[p] === 'object' ? cur[p] : {}; cur = cur[p]; }
    });
  }
  return out;
}

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return out;
}

// Cells beginning with = + - @ (or tab/CR) execute as formulas in Excel/Sheets — CSV injection.
const neutralise = (s) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

function toCsv(rows, delim, safe) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v) => {
    let s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (safe) s = neutralise(s);
    return /["\n\r]/.test(s) || s.includes(delim) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map(esc).join(delim), ...rows.map((r) => cols.map((c) => esc(r[c])).join(delim))].join('\n');
}

const SAMPLE_JSON = JSON.stringify([
  { id: 1, name: 'Asha', email: 'asha@example.com', address: { city: 'Pune', zip: '411001' }, tags: ['admin', 'ops'], active: true },
  { id: 2, name: 'Rahul, Jr.', email: 'rahul@example.com', address: { city: 'Delhi', zip: '110001' }, tags: [], active: false },
  { id: 3, name: '=HYPERLINK("http://evil")', email: 'x@example.com', address: { city: 'Mumbai' }, active: true },
], null, 2);

export default function JsonCsv() {
  const [dir, setDir] = useState('json2csv');
  const [input, setInput] = useState(SAMPLE_JSON);
  const [delimSel, setDelimSel] = useState('auto');
  const [doFlatten, setDoFlatten] = useState(true);
  const [safe, setSafe] = useState(true);
  const [types, setTypes] = useState(true);
  const [nest, setNest] = useState(true);

  const result = useMemo(() => {
    if (!input.trim()) return { out: '' };
    try {
      if (dir === 'json2csv') {
        let data = JSON.parse(input);
        if (!Array.isArray(data)) data = data && typeof data === 'object' ? (Object.values(data).find(Array.isArray) || [data]) : [{ value: data }];
        const rows = data.map((r) => (r && typeof r === 'object' ? (doFlatten ? flatten(r) : r) : { value: r }));
        const d = delimSel === 'auto' ? ',' : delimSel === 'tab' ? '\t' : delimSel;
        return { out: toCsv(rows, d, safe), rows, count: rows.length };
      }
      const d = delimSel === 'auto' ? detectDelim(input) : delimSel === 'tab' ? '\t' : delimSel;
      const [head, ...body] = parseCsv(input, d);
      if (!head) return { out: '[]' };
      const objs = body.map((r) => {
        const o = Object.create(null);
        head.forEach((h, i) => { o[h || `col${i + 1}`] = types ? infer(r[i] ?? '') : (r[i] ?? ''); });
        return nest ? unflatten(o) : { ...o };
      });
      return { out: JSON.stringify(objs, null, 2), rows: objs.map((o) => flatten(o)), count: objs.length, delim: d };
    } catch (e) { return { error: e.message, out: '' }; }
  }, [input, dir, delimSel, doFlatten, safe, types, nest]);

  const swap = () => { setInput(result.out || ''); setDir((d) => (d === 'json2csv' ? 'csv2json' : 'json2csv')); };
  const preview = result.rows?.slice(0, 8) || [];
  const cols = [...new Set(preview.flatMap((r) => Object.keys(r)))].slice(0, 10);

  return (
    <Stack gap="md">
      <Group wrap="wrap">
        <SegmentedControl value={dir} onChange={setDir} data={[{ value: 'json2csv', label: 'JSON → CSV' }, { value: 'csv2json', label: 'CSV → JSON' }]} />
        <Select w={150} size="sm" value={delimSel} onChange={setDelimSel} allowDeselect={false}
          data={[{ value: 'auto', label: 'Delimiter: auto' }, { value: ',', label: 'Comma ,' }, { value: ';', label: 'Semicolon ;' }, { value: 'tab', label: 'Tab' }, { value: '|', label: 'Pipe |' }]} />
        {dir === 'json2csv' ? (
          <>
            <Switch label="Flatten nested (a.b.c)" checked={doFlatten} onChange={(e) => setDoFlatten(e.currentTarget.checked)} />
            <Switch label="Block CSV / formula injection" checked={safe} onChange={(e) => setSafe(e.currentTarget.checked)} />
          </>
        ) : (
          <>
            <Switch label="Detect numbers / booleans" checked={types} onChange={(e) => setTypes(e.currentTarget.checked)} />
            <Switch label="Dotted headers → nested objects" checked={nest} onChange={(e) => setNest(e.currentTarget.checked)} />
          </>
        )}
        <Button variant="light" size="xs" onClick={swap} disabled={!result.out}>Swap ⇄</Button>
      </Group>
      {result.error && <Alert color="red" variant="light" p="xs">{result.error}</Alert>}
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <InputArea label={dir === 'json2csv' ? 'JSON' : 'CSV'} value={input} onChange={setInput} minRows={12} />
        <OutputArea label={dir === 'json2csv' ? 'CSV' : 'JSON'} value={result.out} minRows={12}
          filename={dir === 'json2csv' ? 'data.csv' : 'data.json'} mimeType={dir === 'json2csv' ? 'text/csv' : 'application/json'} />
      </SimpleGrid>
      {preview.length > 0 && (
        <div>
          <Group gap="xs" mb={6}><Text size="sm" fw={600}>Preview</Text><Badge variant="light" size="sm">{result.count} rows</Badge></Group>
          <Table.ScrollContainer minWidth={500}>
            <Table striped withTableBorder fz="xs">
              <Table.Thead><Table.Tr>{cols.map((c) => <Table.Th key={c}>{c}</Table.Th>)}</Table.Tr></Table.Thead>
              <Table.Tbody>{preview.map((r, i) => <Table.Tr key={i}>{cols.map((c) => <Table.Td key={c}>{r[c] === null || r[c] === undefined ? '' : String(r[c])}</Table.Td>)}</Table.Tr>)}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </div>
      )}
      <PrivacyNote />
    </Stack>
  );
}
