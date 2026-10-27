import { useState, useCallback } from 'react';
import { Stack, Group, Paper, Text, Tabs, NumberInput, Switch, Select, TextInput, Badge, Button } from '@mantine/core';
import {
  IconSparkles, IconMinus, IconBug, IconChecklist, IconSortAscendingLetters, IconSearch, IconTransform,
} from '@tabler/icons-react';
import AJV from 'ajv';
import yaml from 'js-yaml';
import CodeToolPage from '../shared/CodeToolPage';
import CodeEditor from '@/shared/components/CodeEditor';
import { repairJson, explainJsonError, sortKeysDeep, jsonStats, jsonPath, jsonToCsv, csvToJson, jsonToTs } from './jsonUtils';

const SAMPLE = `{
  "store": {
    "name": "DevForge Books",
    "url": "https://example.com/books",
    "open": true,
    "books": [
      { "id": 1, "title": "Clean Code", "author": "Robert C. Martin", "price": 32.5, "tags": ["craft", "java"] },
      { "id": 2, "title": "The Pragmatic Programmer", "author": "Hunt & Thomas", "price": 41, "tags": ["career"] },
      { "id": 3, "title": "Security Engineering", "author": "Ross Anderson", "price": 58.99, "isbn": "978-1119642787" }
    ]
  }
}`;

const BROKEN_SAMPLE = `// copied from a config file
{
  name: 'devforge',
  "homepage": "https://dev-tools.serversbay.com", // URLs are safe now
  "debug": True,
  "token": None,
  "features": ["json", "yaml",],
  "limits": { "max": 10 }
  "extra": 1,
}`;

const OPS = [
  { value: 'beautify', label: 'Beautify', icon: IconSparkles },
  { value: 'minify', label: 'Minify', icon: IconMinus },
  { value: 'fix', label: 'Fix / Repair', icon: IconBug },
  { value: 'validate', label: 'Validate', icon: IconChecklist },
  { value: 'sort', label: 'Sort keys', icon: IconSortAscendingLetters },
  { value: 'query', label: 'Query (JSONPath)', icon: IconSearch },
  { value: 'convert', label: 'Convert', icon: IconTransform },
];

const CONVERSIONS = [
  { value: 'csv', label: 'JSON → CSV', lang: 'plaintext', ext: 'csv' },
  { value: 'yaml', label: 'JSON → YAML', lang: 'yaml', ext: 'yaml' },
  { value: 'ts', label: 'JSON → TypeScript', lang: 'typescript', ext: 'ts' },
  { value: 'fromcsv', label: 'CSV → JSON', lang: 'json', ext: 'json' },
  { value: 'string', label: 'JSON → escaped string', lang: 'plaintext', ext: 'txt' },
  { value: 'unstring', label: 'Escaped string → JSON', lang: 'json', ext: 'json' },
];

const QUERY_EXAMPLES = ['$.store.books[*].title', '$..price', '$.store.books[?(@.price > 40)]', '$.store.books[0:2]', '$..tags[*]'];

function parseStrict(text) {
  try { return JSON.parse(text); } catch (e) { throw new Error(explainJsonError(text, e)); }
}

export default function JsonStudio() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [op, setOp] = useState('beautify');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [indent, setIndent] = useState(2);
  const [sortKeys, setSortKeys] = useState(false);
  const [schema, setSchema] = useState('');
  const [query, setQuery] = useState(QUERY_EXAMPLES[0]);
  const [conv, setConv] = useState('csv');
  const [csvSep, setCsvSep] = useState(',');

  const clearStatus = () => { setError(null); setStatus(null); };
  const ind = indent === 0 ? 0 : indent || 2;

  const process = useCallback(() => {
    if (!input.trim()) return;
    clearStatus();
    try {
      const fmt = (v) => JSON.stringify(sortKeys ? sortKeysDeep(v) : v, null, ind);
      switch (op) {
        case 'beautify': {
          const v = parseStrict(input);
          setOutput(fmt(v));
          const s = jsonStats(v);
          setStatus(`Valid · ${s.keys} keys · depth ${s.depth}`);
          break;
        }
        case 'minify': {
          const min = JSON.stringify(parseStrict(input));
          setOutput(min);
          const a = new Blob([input]).size, b = new Blob([min]).size;
          setStatus(`${a.toLocaleString()} → ${b.toLocaleString()} bytes (${Math.round((1 - b / a) * 100)}% smaller)`);
          break;
        }
        case 'fix': {
          try { JSON.parse(input); setOutput(fmt(JSON.parse(input))); setStatus('JSON was already valid'); break; } catch {}
          const { value, fixes } = repairJson(input);
          setOutput(fmt(value));
          setStatus(`Repaired: ${fixes.join(' · ') || 'normalized formatting'}`);
          break;
        }
        case 'validate': {
          const v = parseStrict(input);
          if (schema.trim()) {
            const ajv = new AJV({ allErrors: true, strict: false });
            const validate = ajv.compile(parseStrict(schema));
            if (!validate(v)) {
              setOutput(validate.errors.map((e) => `✗ ${e.instancePath || '/'} ${e.message}${e.params ? ` ${JSON.stringify(e.params)}` : ''}`).join('\n'));
              setError(`${validate.errors.length} schema violation(s)`);
              break;
            }
            setOutput('✓ Valid JSON and matches the schema');
            setStatus('Valid against schema');
          } else {
            setOutput('✓ Valid JSON');
            setStatus('Valid JSON (add a JSON Schema below to validate structure)');
          }
          break;
        }
        case 'sort':
          setOutput(JSON.stringify(sortKeysDeep(parseStrict(input)), null, ind));
          setStatus('Keys sorted recursively');
          break;
        case 'query': {
          const res = jsonPath(parseStrict(input), query);
          setOutput(JSON.stringify(res, null, ind));
          setStatus(`${res.length} match${res.length === 1 ? '' : 'es'}`);
          break;
        }
        case 'convert': {
          if (conv === 'fromcsv') { const rows = csvToJson(input, csvSep === '\\t' ? '\t' : csvSep); setOutput(JSON.stringify(rows, null, ind)); setStatus(`${rows.length} rows`); break; }
          if (conv === 'unstring') { setOutput(JSON.stringify(JSON.parse(JSON.parse(input.trim().startsWith('"') ? input : `"${input}"`)), null, ind)); break; }
          const v = parseStrict(input);
          if (conv === 'csv') setOutput(jsonToCsv(v, csvSep === '\\t' ? '\t' : csvSep));
          else if (conv === 'yaml') setOutput(yaml.dump(v, { indent: ind || 2, noRefs: true }));
          else if (conv === 'ts') setOutput(jsonToTs(v));
          else if (conv === 'string') setOutput(JSON.stringify(JSON.stringify(v)));
          break;
        }
        default:
      }
    } catch (e) {
      setError(e.message);
      setOutput('');
    }
  }, [input, op, ind, sortKeys, schema, query, conv, csvSep]);

  const convInfo = CONVERSIONS.find((c) => c.value === conv);
  const outLang = op === 'convert' ? convInfo.lang : op === 'validate' ? 'plaintext' : 'json';
  const inLang = op === 'convert' && (conv === 'fromcsv' || conv === 'unstring') ? 'plaintext' : 'json';

  return (
    <Stack gap="md">
      <Tabs value={op} onChange={(v) => { setOp(v); clearStatus(); setOutput(''); }}>
        <Tabs.List>
          {OPS.map((o) => (
            <Tabs.Tab key={o.value} value={o.value} leftSection={<o.icon size={14} />}>{o.label}</Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <CodeToolPage
        inputValue={input} onInputChange={setInput} outputValue={output}
        inputLanguage={inLang} outputLanguage={outLang}
        outputFilename={op === 'convert' ? `output.${convInfo.ext}` : 'output.json'}
        process={process} processLabel={OPS.find((o) => o.value === op)?.label}
        error={!!error} statusText={error || status}
        sample={op === 'fix' ? BROKEN_SAMPLE : op === 'convert' && conv === 'fromcsv' ? 'id,name,active,score\n1,Alice,true,92.5\n2,"Smith, Bob",false,78' : SAMPLE}
        onClear={() => { setOutput(''); clearStatus(); }}
        optionsComponent={<>
          <NumberInput size="xs" label="Indent" value={indent} onChange={(v) => setIndent(Number(v))} min={0} max={8} w={80} />
          {['beautify', 'fix'].includes(op) && <Switch size="xs" mt={20} label="Sort keys" checked={sortKeys} onChange={(e) => setSortKeys(e.currentTarget.checked)} />}
          {op === 'convert' && (
            <Select size="xs" label="Conversion" value={conv} onChange={(v) => { setConv(v); setOutput(''); }} data={CONVERSIONS} allowDeselect={false} w={200} />
          )}
          {op === 'convert' && ['csv', 'fromcsv'].includes(conv) && (
            <Select size="xs" label="Delimiter" value={csvSep} onChange={setCsvSep} allowDeselect={false} w={110}
              data={[{ value: ',', label: 'Comma' }, { value: ';', label: 'Semicolon' }, { value: '\\t', label: 'Tab' }, { value: '|', label: 'Pipe' }]} />
          )}
        </>}
      >
        {op === 'query' && (
          <Paper p="sm">
            <TextInput label="JSONPath expression" value={query} onChange={(e) => setQuery(e.currentTarget.value)} className="code-font" leftSection={<IconSearch size={14} />} />
            <Group gap={4} mt="xs">
              <Text size="xs" c="dimmed">Examples:</Text>
              {QUERY_EXAMPLES.map((q) => <Badge key={q} variant="light" tt="none" style={{ cursor: 'pointer' }} onClick={() => setQuery(q)}>{q}</Badge>)}
            </Group>
          </Paper>
        )}
        {op === 'validate' && (
          <Paper p="xs">
            <Group justify="space-between" mb={6} px={4}>
              <Text size="xs" fw={600} c="dimmed">JSON Schema (optional — draft-07 / 2019-09 via Ajv)</Text>
              <Button size="compact-xs" variant="subtle" onClick={() => setSchema(JSON.stringify({ type: 'object', required: ['store'], properties: { store: { type: 'object', required: ['name', 'books'], properties: { name: { type: 'string' }, books: { type: 'array', items: { type: 'object', required: ['id', 'title', 'price'], properties: { price: { type: 'number', minimum: 0 } } } } } } } }, null, 2))}>
                Sample schema
              </Button>
            </Group>
            <CodeEditor value={schema} onChange={setSchema} language="json" height="180px" />
          </Paper>
        )}
        {op === 'fix' && <Text size="xs" c="dimmed">Repairs comments, trailing commas, single quotes, unquoted keys, Python True/False/None, missing commas between lines, smart quotes and JSONP wrappers.</Text>}
      </CodeToolPage>
    </Stack>
  );
}
