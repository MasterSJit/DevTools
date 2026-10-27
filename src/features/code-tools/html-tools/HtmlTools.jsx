import { useState, useCallback } from 'react';
import { Tabs, Stack, Paper, Text, Group, NumberInput, Switch, SegmentedControl } from '@mantine/core';
import { html_beautify } from 'js-beautify';
import CodeToolPage from '../shared/CodeToolPage';
import CodeEditor from '@/shared/components/CodeEditor';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useViewStore } from '@/shared/stores/view.store';

const SAMPLE = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Demo</title><style>body{font-family:system-ui;padding:2rem}h1{color:#4f46e5}</style></head><body><!-- greeting --><h1>Hello DevForge</h1><p>Edit me and watch the <b>live preview</b>.</p><pre>  preformatted
    text stays    intact</pre><button onclick="this.textContent='Clicked!'">Click</button></body></html>`;

// Whitespace inside these elements is significant, so it's shielded from minification.
function minifyHtml(html, { removeComments }) {
  const kept = [];
  let out = html.replace(/<(pre|textarea|script|style)\b[\s\S]*?<\/\1>/gi, (m) => { kept.push(m); return `\u0000${kept.length - 1}\u0000`; });
  if (removeComments) out = out.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');
  out = out.replace(/\s+/g, ' ').replace(/>\s+</g, '><').replace(/\s+>/g, '>').trim();
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
}

function Preview() {
  const [html, setHtml] = useState(SAMPLE);
  const [scripts, setScripts] = useState(false);
  const [device, setDevice] = useState('100%');
  const debounced = useDebounce(html, 300);
  const { viewMode } = useViewStore();
  const horiz = viewMode !== 'vertical';

  return (
    <Stack gap="md">
      <Paper p="sm">
        <Group gap="lg">
          <Switch size="xs" label="Allow JavaScript in preview" checked={scripts} onChange={(e) => setScripts(e.currentTarget.checked)} />
          <SegmentedControl size="xs" value={device} onChange={setDevice}
            data={[{ value: '100%', label: 'Full' }, { value: '768px', label: 'Tablet' }, { value: '375px', label: 'Mobile' }]} />
        </Group>
      </Paper>
      <div style={{ display: 'flex', flexDirection: horiz ? 'row' : 'column', gap: 'var(--mantine-spacing-md)' }}>
        <Paper p="xs" style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" fw={600} c="dimmed" mb={6} px={4}>HTML</Text>
          <CodeEditor value={html} onChange={setHtml} language="html" height="520px" />
        </Paper>
        <Paper p="xs" style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" fw={600} c="dimmed" mb={6} px={4}>Preview (sandboxed{scripts ? ', scripts on' : ', scripts off'})</Text>
          <div className="df-checker rounded-lg flex justify-center" style={{ height: 520 }}>
            <iframe
              srcDoc={debounced}
              // No allow-same-origin: the preview can never touch this app's storage or cookies.
              sandbox={scripts ? 'allow-scripts allow-modals' : ''}
              title="HTML preview"
              style={{ width: device, height: '100%', border: 'none', borderRadius: 8, background: '#fff' }}
            />
          </div>
        </Paper>
      </div>
    </Stack>
  );
}

export default function HtmlTools() {
  const [tab, setTab] = useState('format');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [indent, setIndent] = useState(2);
  const [removeComments, setRemoveComments] = useState(true);

  const run = useCallback(() => {
    setError(null);
    try {
      if (tab === 'format') {
        setOutput(html_beautify(input, { indent_size: indent, wrap_line_length: 120, extra_liners: [], indent_inner_html: true }));
        setStatus(null);
      } else {
        const out = minifyHtml(input, { removeComments });
        setOutput(out);
        const a = new Blob([input]).size, b = new Blob([out]).size;
        setStatus(`${a.toLocaleString()} → ${b.toLocaleString()} bytes (${a ? Math.round((1 - b / a) * 100) : 0}% smaller)`);
      }
    } catch (e) { setError(e.message); }
  }, [input, tab, indent, removeComments]);

  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={(v) => { setTab(v); setOutput(''); setError(null); setStatus(null); }}>
        <Tabs.List>
          <Tabs.Tab value="format">Formatter</Tabs.Tab>
          <Tabs.Tab value="minify">Minifier</Tabs.Tab>
          <Tabs.Tab value="preview">Live Preview</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'preview' ? <Preview /> : (
        <CodeToolPage
          inputValue={input} onInputChange={setInput} outputValue={output}
          inputLanguage="html" outputLanguage="html"
          process={run} processLabel={tab === 'format' ? 'Format HTML' : 'Minify HTML'}
          error={!!error} statusText={error || status}
          sample={SAMPLE}
          onClear={() => { setOutput(''); setStatus(null); }}
          optionsComponent={tab === 'format'
            ? <NumberInput size="xs" label="Indent" value={indent} onChange={(v) => setIndent(Number(v) || 2)} min={1} max={8} w={80} />
            : <Switch size="xs" label="Remove comments" checked={removeComments} onChange={(e) => setRemoveComments(e.currentTarget.checked)} />}
        />
      )}
    </Stack>
  );
}
