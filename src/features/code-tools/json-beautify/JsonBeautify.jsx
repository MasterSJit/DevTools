import { useState, useCallback } from 'react';
import { NumberInput, Switch, Group } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import CodeToolPage from '../shared/CodeToolPage';

export default function JsonBeautify() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [indent, setIndent] = useState(2);
  const [sortKeys, setSortKeys] = useState(false);

  const process = useCallback(() => {
    setLoading(true); setError(null);
    try {
      let parsed = JSON.parse(input);
      if (sortKeys) parsed = sortObjKeys(parsed);
      setOutput(JSON.stringify(parsed, null, indent));
    } catch (e) { setError(e.message); setOutput(''); }
    setLoading(false);
  }, [input, indent, sortKeys]);

  return (
    <CodeToolPage
      title="JSON Beautify"
      description="Pretty-print JSON with configurable indentation and key sorting"
      icon={IconSparkles}
      inputValue={input} onInputChange={setInput}
      outputValue={output}
      inputLanguage="json" outputLanguage="json"
      process={process} processLabel="Beautify"
      loading={loading} error={!!error}
      statusText={error || null}
      optionsComponent={
        <Group>
          <NumberInput label="Indent" value={indent} onChange={setIndent} min={1} max={8} w={100} />
          <Switch label="Sort keys" checked={sortKeys} onChange={(e) => setSortKeys(e.currentTarget.checked)} mt={24} />
        </Group>
      }
    />
  );
}

function sortObjKeys(obj) {
  if (Array.isArray(obj)) return obj.map(sortObjKeys);
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = sortObjKeys(obj[k]); return acc; }, {});
  }
  return obj;
}