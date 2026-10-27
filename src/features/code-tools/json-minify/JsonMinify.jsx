import { useState, useCallback } from 'react';
import { IconMinimize } from '@tabler/icons-react';
import CodeToolPage from '../shared/CodeToolPage';

export default function JsonMinify() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const process = useCallback(() => {
    setLoading(true); setError(null);
    try {
      const parsed = JSON.parse(input);
      const minified = JSON.stringify(parsed);
      setOutput(minified);
    } catch (e) { setError(e.message); setOutput(''); }
    setLoading(false);
  }, [input]);

  const sizeInfo = output ? `${new Blob([input]).size} → ${new Blob([output]).size} bytes` : null;

  return (
    <CodeToolPage
      title="JSON Minify"
      description="Remove all whitespace to produce compact JSON"
      icon={IconMinimize}
      inputValue={input} onInputChange={setInput}
      outputValue={output}
      inputLanguage="json" outputLanguage="json"
      process={process} processLabel="Minify"
      loading={loading} error={!!error}
      statusText={error || sizeInfo}
    />
  );
}