import { useState, useCallback } from 'react';
import { Tabs, Stack } from '@mantine/core';
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import CodeToolPage from '../shared/CodeToolPage';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<catalog><book id="bk101" lang="en"><author>Gambardella, Matthew</author><title>XML Developer's Guide</title><price currency="USD">44.95</price></book><book id="bk102"><author>Ralls, Kim</author><title>Midnight Rain</title><price currency="USD">5.95</price></book></catalog>`;

// Validate first so errors carry a line/column instead of a silent bad parse.
function assertValid(xml) {
  const res = XMLValidator.validate(xml, { allowBooleanAttributes: true });
  if (res !== true) throw new Error(`${res.err.msg} (line ${res.err.line}, col ${res.err.col})`);
}

export default function XmlTools() {
  const [tab, setTab] = useState('format');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  const reset = () => { setOutput(''); setError(null); setStatus(null); };

  const run = useCallback(() => {
    setError(null); setStatus(null);
    try {
      if (tab === 'format') {
        assertValid(input);
        const parsed = new XMLParser({ ignoreAttributes: false, preserveOrder: true, commentPropName: '#comment', cdataPropName: '#cdata' }).parse(input);
        setOutput(new XMLBuilder({ format: true, ignoreAttributes: false, preserveOrder: true, indentBy: '  ', commentPropName: '#comment', cdataPropName: '#cdata' }).build(parsed).trim());
      } else if (tab === 'minify') {
        assertValid(input);
        setOutput(input.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').trim());
      } else if (tab === 'validate') {
        assertValid(input);
        setOutput('✓ Well-formed XML');
        setStatus('Valid XML');
      } else if (tab === 'xml2json') {
        assertValid(input);
        setOutput(JSON.stringify(new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseAttributeValue: true }).parse(input), null, 2));
      } else {
        setOutput(new XMLBuilder({ format: true, ignoreAttributes: false, attributeNamePrefix: '@_', indentBy: '  ' }).build(JSON.parse(input)));
      }
    } catch (e) { setError(e.message); setOutput(''); }
  }, [input, tab]);

  const labels = { format: 'Format XML', minify: 'Minify XML', validate: 'Validate', xml2json: 'XML → JSON', json2xml: 'JSON → XML' };

  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={(v) => { setTab(v); reset(); }}>
        <Tabs.List>
          <Tabs.Tab value="format">Formatter</Tabs.Tab>
          <Tabs.Tab value="minify">Minifier</Tabs.Tab>
          <Tabs.Tab value="validate">Validator</Tabs.Tab>
          <Tabs.Tab value="xml2json">XML → JSON</Tabs.Tab>
          <Tabs.Tab value="json2xml">JSON → XML</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <CodeToolPage
        inputValue={input} onInputChange={setInput} outputValue={output}
        inputLanguage={tab === 'json2xml' ? 'json' : 'xml'}
        outputLanguage={tab === 'xml2json' ? 'json' : tab === 'validate' ? 'plaintext' : 'xml'}
        process={run} processLabel={labels[tab]}
        error={!!error} statusText={error || status}
        sample={tab === 'json2xml' ? JSON.stringify({ note: { '@_id': 1, to: 'Tove', from: 'Jani', body: 'Hello' } }, null, 2) : SAMPLE}
        onClear={reset}
      />
    </Stack>
  );
}
