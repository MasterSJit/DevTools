import { useState, useCallback } from 'react';
import { Stack, Collapse, Button, Paper, Text, Badge, Group } from '@mantine/core';
import { IconChecklist, IconSettings } from '@tabler/icons-react';
import CodeEditor from '@/shared/components/CodeEditor';
import CodeToolPage from '../shared/CodeToolPage';

export default function JsonLinter() {
  const [input, setInput] = useState('');
  const [schema, setSchema] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSchema, setShowSchema] = useState(false);

  const process = useCallback(() => {
    setLoading(true); setError(null);
    try {
      const parsed = JSON.parse(input);
      if (schema.trim()) {
        const ajv = new (require('ajv').default)({ allErrors: true });
        const validate = ajv.compile(JSON.parse(schema));
        if (!validate(parsed)) {
          const errors = validate.errors.map((e) => `${e.instancePath || '/'}: ${e.message} (${e.keyword})`).join('\n');
          setError(`${validate.errors.length} schema error(s)`);
          setOutput(errors);
          setLoading(false);
          return;
        }
      }
      setOutput(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e) {
      const m = e.message.match(/position (\d+)/);
      setError(`Syntax error${m ? ` at pos ${m[1]}` : ''}: ${e.message}`);
      setOutput('');
    }
    setLoading(false);
  }, [input, schema]);

  return (
    <Stack gap="md">
      <CodeToolPage
        title="JSON Linter"
        description="Validate JSON syntax and optionally check against a JSON Schema"
        icon={IconChecklist}
        inputValue={input} onInputChange={setInput}
        outputValue={output}
        inputLanguage="json" outputLanguage="json"
        process={process} processLabel="Validate"
        loading={loading} error={!!error}
        statusText={error || (output && !error ? 'Valid JSON ✓' : null)}
      />
      <Group>
        <Button variant="subtle" size="xs" leftSection={<IconSettings size={14} />}
          onClick={() => setShowSchema((v) => !v)}>
          {showSchema ? 'Hide' : 'Show'} JSON Schema
        </Button>
      </Group>
      <Collapse in={showSchema}>
        <Paper withBorder p="xs">
          <Text size="xs" fw={500} c="dimmed" mb={4}>JSON Schema (optional)</Text>
          <CodeEditor value={schema} onChange={setSchema} language="json" height="200px"
            placeholder='{"type":"object","properties":{"name":{"type":"string"}}}' />
        </Paper>
      </Collapse>
    </Stack>
  );
}