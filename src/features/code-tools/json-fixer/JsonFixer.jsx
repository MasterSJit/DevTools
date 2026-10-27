import { useState, useCallback } from 'react';
import json5 from 'json5';
import { IconBug } from '@tabler/icons-react';
import CodeToolPage from '../shared/CodeToolPage';

export default function JsonFixer() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);
  const [fixes, setFixes] = useState([]);
  const [loading, setLoading] = useState(false);

  const process = useCallback(() => {
    setLoading(true); setError(null); setFixes([]);
    try {
      const applied = [];
      let text = input;
      if (/\/\/.*$/m.test(text)) { text = text.replace(/\/\/.*$/gm, ''); applied.push('Removed comments'); }
      if (/\/\*[\s\S]*?\*\//.test(text)) { text = text.replace(/\/\*[\s\S]*?\*\//g, ''); applied.push('Removed block comments'); }
      if (/,\s*[}\]]/.test(text)) { text = text.replace(/,\s*([}\]])/g, '$1'); applied.push('Removed trailing commas'); }

      let parsed;
      try { parsed = JSON.parse(text); }
      catch { parsed = json5.parse(text); applied.push('Applied JSON5 lenient parsing'); }

      setOutput(JSON.stringify(parsed, null, 2));
      setFixes(applied.length > 0 ? applied : ['JSON was already valid']);
    } catch (e) { setError(e.message); setOutput(''); }
    setLoading(false);
  }, [input]);

  return (
    <CodeToolPage
      title="JSON Fixer"
      description="Automatically fix trailing commas, comments, single quotes, and unquoted keys"
      icon={IconBug}
      inputValue={input} onInputChange={setInput}
      outputValue={output}
      inputLanguage="json" outputLanguage="json"
      process={process} processLabel="Fix JSON"
      loading={loading} error={error}
      statusText={error || fixes.join(' | ') || null}
    />
  );
}