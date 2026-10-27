import { useState, useCallback, useEffect, useMemo } from 'react';
import { Select, Switch, NumberInput, SegmentedControl } from '@mantine/core';
import CodeToolPage from '../shared/CodeToolPage';
import { LANGUAGES, CLANG_STYLES, SAMPLES, MINIFY_SAMPLES, formatCode, minifyCode } from './languages';

const SQL_DIALECTS = ['sql', 'mysql', 'mariadb', 'postgresql', 'sqlite', 'transactsql', 'plsql', 'bigquery', 'snowflake', 'redshift', 'spark', 'trino'];

const groupedData = () => {
  const groups = {};
  Object.entries(LANGUAGES).forEach(([value, l]) => { (groups[l.group] ||= []).push({ value, label: `${l.label}${l.minify ? '  · minify' : ''}` }); });
  return Object.entries(groups).map(([group, items]) => ({ group, items }));
};

export default function JsFormatter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [lang, setLang] = useState('javascript');
  const [mode, setMode] = useState('format');
  const [indent, setIndent] = useState(2);
  const [useTabs, setUseTabs] = useState(false);
  const [printWidth, setPrintWidth] = useState(100);
  const [semi, setSemi] = useState(true);
  const [singleQuote, setSingleQuote] = useState(true);
  const [clangStyle, setClangStyle] = useState('Google');
  const [sqlDialect, setSqlDialect] = useState('sql');

  // Deep links like /tools/js-formatter/?lang=css&mode=minify (the old CSS Tools route redirects here)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (LANGUAGES[p.get('lang')]) { setLang(p.get('lang')); setIndent(LANGUAGES[p.get('lang')].indent || 2); }
    if (p.get('mode') === 'minify') setMode('minify');
  }, []);

  const info = LANGUAGES[lang];
  const canMinify = !!info.minify;
  const effectiveMode = mode === 'minify' && canMinify ? 'minify' : 'format';
  const data = useMemo(groupedData, []);

  const process = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true); setError(null); setStatus(null);
    try {
      const out = effectiveMode === 'minify'
        ? await minifyCode(lang, input)
        : await formatCode(lang, input, { indent, useTabs, printWidth, semi, singleQuote, clangStyle, sqlDialect });
      setOutput(out);
      if (effectiveMode === 'minify') {
        const a = new Blob([input]).size, b = new Blob([out]).size;
        setStatus(`${a.toLocaleString()} → ${b.toLocaleString()} bytes (${a ? Math.round((1 - b / a) * 100) : 0}% smaller)`);
      }
    } catch (e) {
      setError(String(e?.message || e).split('\n')[0]);
    }
    setLoading(false);
  }, [input, lang, effectiveMode, indent, useTabs, printWidth, semi, singleQuote, clangStyle, sqlDialect]);

  const isPrettier = info.engine === 'prettier';
  const usesQuotes = isPrettier && ['babel', 'typescript', 'vue', 'angular'].includes(info.parser) || info.engine === 'ruff';

  return (
    <CodeToolPage
      inputValue={input} onInputChange={setInput} outputValue={output}
      inputLanguage={info.monaco} outputLanguage={info.monaco}
      outputFilename={`${effectiveMode === 'minify' ? 'min' : 'formatted'}.${info.ext}`}
      process={process} processLabel={effectiveMode === 'minify' ? 'Minify' : 'Format'}
      loading={loading} error={!!error} statusText={error || status}
      sample={(effectiveMode === 'minify' && MINIFY_SAMPLES[lang]) || SAMPLES[lang]}
      onClear={() => { setOutput(''); setError(null); setStatus(null); }}
      optionsComponent={<>
        <Select size="xs" label="Language" value={lang} onChange={(v) => { if (v) { setLang(v); setIndent(LANGUAGES[v].indent || 2); setOutput(''); setError(null); setStatus(null); } }}
          data={data} searchable allowDeselect={false} w={240} maxDropdownHeight={420} />
        <SegmentedControl size="xs" mt={20} value={effectiveMode} onChange={setMode}
          data={[{ value: 'format', label: 'Format' }, { value: 'minify', label: 'Minify', disabled: !canMinify }]} />
        {effectiveMode === 'format' && info.engine !== 'gofmt' && info.engine !== 'zig' && (
          <>
            <NumberInput size="xs" label="Indent" value={indent} onChange={(v) => setIndent(Number(v) || 2)} min={1} max={8} w={80} />
            <NumberInput size="xs" label="Line width" value={printWidth} onChange={(v) => setPrintWidth(Number(v) || 80)} min={40} max={200} w={95} />
            <Switch size="xs" mt={20} label="Tabs" checked={useTabs} onChange={(e) => setUseTabs(e.currentTarget.checked)} />
          </>
        )}
        {effectiveMode === 'format' && isPrettier && ['babel', 'typescript', 'vue'].includes(info.parser) && (
          <Switch size="xs" mt={20} label="Semicolons" checked={semi} onChange={(e) => setSemi(e.currentTarget.checked)} />
        )}
        {effectiveMode === 'format' && usesQuotes && (
          <Switch size="xs" mt={20} label="Single quotes" checked={singleQuote} onChange={(e) => setSingleQuote(e.currentTarget.checked)} />
        )}
        {effectiveMode === 'format' && info.engine === 'clang' && (
          <Select size="xs" label="Style" value={clangStyle} onChange={(v) => v && setClangStyle(v)} data={CLANG_STYLES} w={120} allowDeselect={false} />
        )}
        {info.engine === 'sql' && effectiveMode === 'format' && (
          <Select size="xs" label="Dialect" value={sqlDialect} onChange={(v) => v && setSqlDialect(v)} data={SQL_DIALECTS} w={130} allowDeselect={false} />
        )}
      </>}
    />
  );
}
