import { useState, useCallback } from 'react';
import { Tabs, Stack, NumberInput, Switch } from '@mantine/core';
import yaml from 'js-yaml';
import CodeToolPage from '../shared/CodeToolPage';

const SAMPLE = `# Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata: {name: web, labels: {app: web}}
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: web
          image: nginx:1.27
          ports: [{containerPort: 80}]
---
apiVersion: v1
kind: Service
metadata: {name: web}
spec: {ports: [{port: 80}], selector: {app: web}}`;

// Multi-document aware: every "---" separated document is handled.
const loadAll = (text) => {
  const docs = [];
  yaml.loadAll(text, (d) => docs.push(d));
  return docs;
};

const formatErr = (e) => (e.mark ? `${e.reason} (line ${e.mark.line + 1}, col ${e.mark.column + 1})` : e.message);

export default function YamlTools() {
  const [tab, setTab] = useState('format');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [indent, setIndent] = useState(2);
  const [sortKeys, setSortKeys] = useState(false);

  const reset = () => { setOutput(''); setError(null); setStatus(null); };

  const run = useCallback(() => {
    setError(null); setStatus(null);
    try {
      const dumpOpts = { indent, lineWidth: 120, sortKeys, noRefs: true };
      if (tab === 'format') {
        setOutput(loadAll(input).map((d) => yaml.dump(d, dumpOpts)).join('---\n'));
      } else if (tab === 'validate') {
        const docs = loadAll(input);
        setOutput(`✓ Valid YAML — ${docs.length} document${docs.length === 1 ? '' : 's'}`);
        setStatus('Valid YAML');
      } else if (tab === 'y2j') {
        const docs = loadAll(input);
        setOutput(JSON.stringify(docs.length === 1 ? docs[0] : docs, null, indent));
      } else {
        setOutput(yaml.dump(JSON.parse(input), dumpOpts));
      }
    } catch (e) { setError(formatErr(e)); setOutput(''); }
  }, [input, tab, indent, sortKeys]);

  const labels = { format: 'Format', validate: 'Validate', y2j: 'YAML → JSON', j2y: 'JSON → YAML' };

  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={(v) => { setTab(v); reset(); }}>
        <Tabs.List>
          <Tabs.Tab value="format">Formatter</Tabs.Tab>
          <Tabs.Tab value="validate">Validator</Tabs.Tab>
          <Tabs.Tab value="y2j">YAML → JSON</Tabs.Tab>
          <Tabs.Tab value="j2y">JSON → YAML</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <CodeToolPage
        inputValue={input} onInputChange={setInput} outputValue={output}
        inputLanguage={tab === 'j2y' ? 'json' : 'yaml'}
        outputLanguage={tab === 'y2j' ? 'json' : tab === 'validate' ? 'plaintext' : 'yaml'}
        process={run} processLabel={labels[tab]}
        error={!!error} statusText={error || status}
        sample={tab === 'j2y' ? JSON.stringify({ server: { host: 'localhost', ports: [80, 443] }, debug: false }, null, 2) : SAMPLE}
        onClear={reset}
        optionsComponent={<>
          <NumberInput size="xs" label="Indent" value={indent} onChange={(v) => setIndent(Number(v) || 2)} min={1} max={8} w={90} />
          <Switch size="xs" mt={20} label="Sort keys" checked={sortKeys} onChange={(e) => setSortKeys(e.currentTarget.checked)} />
        </>}
      />
    </Stack>
  );
}
