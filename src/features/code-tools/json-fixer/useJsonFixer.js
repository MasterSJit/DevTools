import { useState, useCallback } from 'react';
import json5 from 'json5';

export function useJsonFixer() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);
  const [fixes, setFixes] = useState([]);
  const [loading, setLoading] = useState(false);

  const process = useCallback(() => {
    setLoading(true);
    setError(null);
    setFixes([]);
    try {
      const applied = [];
      let text = input;

      // Remove single-line comments
      if (text.match(/\/\/.*$/m)) { text = text.replace(/\/\/.*$/gm, ''); applied.push('Removed single-line comments'); }
      // Remove multi-line comments
      if (text.match(/\/\*[\s\S]*?\*\//)) { text = text.replace(/\/\*[\s\S]*?\*\//g, ''); applied.push('Removed multi-line comments'); }
      // Fix trailing commas before } or ]
      if (text.match(/,\s*[}\]]/)) { text = text.replace(/,\s*([}\]])/g, '$1'); applied.push('Removed trailing commas'); }
      // Fix single quotes to double quotes (simple cases)
      if (text.includes("'")) { text = text.replace(/'([^']*)'/g, '"$1"'); applied.push('Replaced single quotes with double quotes'); }

      // Try to parse with json5 (handles unquoted keys, etc.)
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        try {
          parsed = json5.parse(text);
          applied.push('Fixed unquoted keys/values (JSON5)');
        } catch (e) {
          setError(`Cannot fix: ${e.message}`);
          setOutput('');
          setLoading(false);
          return;
        }
      }

      const result = JSON.stringify(parsed, null, 2);
      setOutput(result);
      setFixes(applied.length > 0 ? applied : ['No fixes needed — JSON was already valid']);
    } catch (e) {
      setError(e.message);
      setOutput('');
    }
    setLoading(false);
  }, [input]);

  return { input, setInput, output, error, fixes, loading, process };
}