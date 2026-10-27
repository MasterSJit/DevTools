import { useState, useCallback } from 'react';
import { Select, Switch, NumberInput } from '@mantine/core';
import { format } from 'sql-formatter';
import CodeToolPage from '../shared/CodeToolPage';

const DIALECTS = [
  { value: 'sql', label: 'Standard SQL' }, { value: 'mysql', label: 'MySQL' }, { value: 'mariadb', label: 'MariaDB' },
  { value: 'postgresql', label: 'PostgreSQL' }, { value: 'sqlite', label: 'SQLite' }, { value: 'transactsql', label: 'SQL Server (T-SQL)' },
  { value: 'plsql', label: 'Oracle PL/SQL' }, { value: 'bigquery', label: 'BigQuery' }, { value: 'snowflake', label: 'Snowflake' },
  { value: 'redshift', label: 'Redshift' }, { value: 'spark', label: 'Spark SQL' }, { value: 'trino', label: 'Trino / Presto' },
  { value: 'db2', label: 'IBM Db2' }, { value: 'hive', label: 'Hive' },
];

const SAMPLE = `select u.id, u.name, count(o.id) as orders, sum(o.total) total_spent from users u left join orders o on o.user_id = u.id where u.created_at >= '2026-01-01' and u.status in ('active','trial') group by u.id, u.name having count(o.id) > 2 order by total_spent desc limit 50;`;

export default function SqlFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);
  const [dialect, setDialect] = useState('sql');
  const [upper, setUpper] = useState(true);
  const [tabWidth, setTabWidth] = useState(2);
  const [minify, setMinify] = useState(false);

  const process = useCallback(() => {
    setError(null);
    try {
      if (minify) {
        setOutput(input.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim());
      } else {
        setOutput(format(input, { language: dialect, keywordCase: upper ? 'upper' : 'preserve', tabWidth, linesBetweenQueries: 2 }));
      }
    } catch (e) { setError(e.message); setOutput(''); }
  }, [input, dialect, upper, tabWidth, minify]);

  return (
    <CodeToolPage
      inputValue={input} onInputChange={setInput} outputValue={output}
      inputLanguage="sql" outputLanguage="sql"
      process={process} processLabel={minify ? 'Minify SQL' : 'Format SQL'}
      error={!!error} statusText={error || null}
      sample={SAMPLE}
      onClear={() => { setOutput(''); setError(null); }}
      optionsComponent={<>
        <Select size="xs" label="Dialect" value={dialect} onChange={setDialect} data={DIALECTS} w={190} allowDeselect={false} searchable />
        <NumberInput size="xs" label="Indent" value={tabWidth} onChange={(v) => setTabWidth(Number(v) || 2)} min={1} max={8} w={80} />
        <Switch size="xs" mt={20} label="UPPERCASE keywords" checked={upper} onChange={(e) => setUpper(e.currentTarget.checked)} />
        <Switch size="xs" mt={20} label="Minify" checked={minify} onChange={(e) => setMinify(e.currentTarget.checked)} />
      </>}
    />
  );
}
