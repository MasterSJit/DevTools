import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Stack, Group, Button, Badge, Paper, Text, Switch, SegmentedControl, Select, Loader, Center } from '@mantine/core';
import { IconArrowsExchange, IconTrash, IconCopy, IconDownload } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import CodeEditor from '@/shared/components/CodeEditor';
import FileDropZone from '@/shared/components/FileDropZone';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useResolvedScheme } from '@/shared/hooks/useResolvedScheme';
import { useViewStore } from '@/shared/stores/view.store';
import { downloadText } from '@/shared/lib/download';

const DiffEditor = lazy(() => import('@monaco-editor/react').then((m) => ({ default: m.DiffEditor })));

const LANGS = ['plaintext', 'javascript', 'typescript', 'json', 'html', 'css', 'python', 'java', 'go', 'rust', 'php', 'sql', 'yaml', 'xml', 'markdown', 'shell'];

const SAMPLE_A = `{
  "name": "devforge",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "next": "^14.2.5",
    "react": "^18.3.1"
  }
}`;
const SAMPLE_B = `{
  "name": "devforge",
  "version": "2.0.0",
  "private": true,
  "dependencies": {
    "acorn": "^8.14.0",
    "next": "^14.2.35",
    "react": "^18.3.1"
  }
}`;

export default function DiffViewer() {
  const [original, setOriginal] = useState(SAMPLE_A);
  const [modified, setModified] = useState(SAMPLE_B);
  const [result, setResult] = useState(null);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  // Local view state — this used to write into the global layout store and break other tools.
  const [diffView, setDiffView] = useState('split');
  const [language, setLanguage] = useState('json');
  const [busy, setBusy] = useState(false);
  const copy = useCopyToClipboard();
  const workerRef = useRef(null);
  const scheme = useResolvedScheme();
  const { viewMode } = useViewStore();

  const a = useDebounce(original, 300);
  const b = useDebounce(modified, 300);

  useEffect(() => {
    workerRef.current = new Worker(new URL('@/shared/workers/diff.worker.js', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e) => { setResult(e.data); setBusy(false); };
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (!workerRef.current) return;
    setBusy(true);
    workerRef.current.postMessage({ original: a, modified: b, options: { ignoreWhitespace, ignoreCase } });
  }, [a, b, ignoreWhitespace, ignoreCase]);

  const stats = result?.stats;
  const horiz = viewMode !== 'vertical';

  return (
    <Stack gap="md">
      <Paper p="sm">
        <Group justify="space-between" gap="sm">
          <Group gap="md">
            <SegmentedControl size="xs" value={diffView} onChange={setDiffView}
              data={[{ label: 'Side by side', value: 'split' }, { label: 'Inline', value: 'inline' }]} />
            <Select size="xs" value={language} onChange={(v) => v && setLanguage(v)} data={LANGS} w={130} searchable aria-label="Syntax" />
            <Switch size="xs" label="Ignore whitespace" checked={ignoreWhitespace} onChange={(e) => setIgnoreWhitespace(e.currentTarget.checked)} />
            <Switch size="xs" label="Ignore case" checked={ignoreCase} onChange={(e) => setIgnoreCase(e.currentTarget.checked)} />
          </Group>
          <Group gap="xs">
            <Button size="xs" variant="light" leftSection={<IconArrowsExchange size={14} />} onClick={() => { setOriginal(modified); setModified(original); }}>Swap</Button>
            <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={() => { setOriginal(''); setModified(''); }}>Clear</Button>
          </Group>
        </Group>
      </Paper>

      <div style={{ display: 'flex', flexDirection: horiz ? 'row' : 'column', gap: 'var(--mantine-spacing-md)' }}>
        {[['Original', original, setOriginal], ['Modified', modified, setModified]].map(([label, value, set]) => (
          <Paper key={label} p="xs" style={{ flex: 1, minWidth: 0 }}>
            <Group justify="space-between" mb={6} px={4}>
              <Text size="xs" fw={600} c="dimmed">{label}</Text>
              <FileDropZone compact onFile={(f) => f.text().then(set)} />
            </Group>
            <CodeEditor value={value} onChange={set} language={language} height="220px" />
          </Paper>
        ))}
      </div>

      <Paper p="xs">
        <Group justify="space-between" mb={6} px={4}>
          <Group gap="xs">
            <Text size="xs" fw={600} c="dimmed">Differences</Text>
            {busy && <Loader size={12} />}
            {stats && (result.identical
              ? <Badge color="teal" variant="light">Identical</Badge>
              : <>
                <Badge color="green" variant="light">+{stats.added} lines</Badge>
                <Badge color="red" variant="light">−{stats.removed} lines</Badge>
                <Badge variant="light" color="gray">{stats.hunks} change block{stats.hunks === 1 ? '' : 's'}</Badge>
                <Badge variant="outline" color="gray">{stats.percentChanged}% changed</Badge>
              </>)}
          </Group>
          <Group gap="xs">
            <Button size="compact-xs" variant="light" leftSection={<IconCopy size={12} />} disabled={!result?.patch}
              onClick={() => { copy(result.patch); notifications.show({ message: 'Unified patch copied', color: 'teal' }); }}>Copy patch</Button>
            <Button size="compact-xs" variant="light" leftSection={<IconDownload size={12} />} disabled={!result?.patch}
              onClick={() => downloadText(result.patch, 'changes.patch')}>.patch</Button>
          </Group>
        </Group>
        <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
          <Suspense fallback={<Center h={420}><Loader size="sm" /></Center>}>
            <DiffEditor
              height="440px"
              language={language}
              original={original}
              modified={modified}
              theme={scheme === 'dark' ? 'vs-dark' : 'vs'}
              options={{
                renderSideBySide: diffView === 'split',
                readOnly: true,
                originalEditable: false,
                ignoreTrimWhitespace: ignoreWhitespace,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 13,
                renderOverviewRuler: true,
                automaticLayout: true,
              }}
            />
          </Suspense>
        </div>
      </Paper>
    </Stack>
  );
}
