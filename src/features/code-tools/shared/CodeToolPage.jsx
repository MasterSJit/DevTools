import { useEffect, useRef, useState } from 'react';
import { Stack, Group, Button, Badge, Text, Paper, Switch, Tooltip, Kbd } from '@mantine/core';
import { IconPlayerPlay, IconArrowsExchange, IconTrash, IconFileText } from '@tabler/icons-react';
import CodeEditor from '@/shared/components/CodeEditor';
import CopyButton from '@/shared/components/CopyButton';
import DownloadButton from '@/shared/components/DownloadButton';
import FileDropZone from '@/shared/components/FileDropZone';
import { useViewStore } from '@/shared/stores/view.store';
import { formatBytes } from '@/shared/lib/download';

const EXT = { json: 'json', xml: 'xml', yaml: 'yaml', sql: 'sql', html: 'html', css: 'css', javascript: 'js', typescript: 'ts', markdown: 'md' };
const byteLen = (s) => (s ? new TextEncoder().encode(s).length : 0);

export default function CodeToolPage({
  inputValue, onInputChange,
  outputValue,
  inputLanguage = 'plaintext', outputLanguage = 'plaintext',
  process, processLabel = 'Process',
  optionsComponent,
  loading = false,
  error,
  showInput = true, showOutput = true,
  onClear,
  children,
  statusText,
  singlePanel = false,
  sample,
  outputFilename,
  autoRun = true,
}) {
  const { viewMode } = useViewStore();
  const [live, setLive] = useState(autoRun);
  const processRef = useRef(process);
  processRef.current = process;

  const isHorizontal = viewMode !== 'vertical';
  const editorHeight = singlePanel ? '480px' : isHorizontal ? '420px' : '280px';

  // Live mode: re-run shortly after the input (or the options captured by `process`) change.
  useEffect(() => {
    if (!live || !showOutput || !inputValue?.trim()) return;
    const t = setTimeout(() => processRef.current?.(), 400);
    return () => clearTimeout(t);
  }, [live, process, inputValue, showOutput]);

  // Ctrl/Cmd + Enter runs the tool
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); processRef.current?.(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const inBytes = byteLen(inputValue);
  const outBytes = byteLen(outputValue);

  return (
    <Stack gap="md">
      {(optionsComponent || showOutput) && (
        <Paper p="sm">
          <Group justify="space-between" gap="sm" wrap="wrap">
            <Group gap="md" wrap="wrap">{optionsComponent}</Group>
            {showOutput && (
              <Tooltip label="Re-run automatically as you type">
                <Switch size="xs" label="Live" checked={live} onChange={(e) => setLive(e.currentTarget.checked)} />
              </Tooltip>
            )}
          </Group>
        </Paper>
      )}

      {children}

      <div style={{
        display: 'flex',
        flexDirection: isHorizontal && showInput && showOutput ? 'row' : 'column',
        gap: 'var(--mantine-spacing-md)',
      }}>
        {showInput && (
          <Paper p="xs" style={{ flex: 1, minWidth: 0 }}>
            <Group justify="space-between" mb={6} px={4}>
              <Group gap={6}>
                <Text size="xs" fw={600} c="dimmed">Input</Text>
                {inBytes > 0 && <Badge size="xs" variant="light" color="gray">{formatBytes(inBytes)}</Badge>}
              </Group>
              <Group gap={6}>
                {sample && (
                  <Button size="compact-xs" variant="subtle" leftSection={<IconFileText size={12} />} onClick={() => onInputChange(sample)}>
                    Sample
                  </Button>
                )}
                <FileDropZone compact onFile={(f) => f.text().then(onInputChange)} />
              </Group>
            </Group>
            <CodeEditor value={inputValue} onChange={onInputChange} language={inputLanguage} height={editorHeight} />
          </Paper>
        )}

        {showOutput && (
          <Paper p="xs" style={{ flex: 1, minWidth: 0 }}>
            <Group justify="space-between" mb={6} px={4}>
              <Group gap={6}>
                <Text size="xs" fw={600} c="dimmed">Output</Text>
                {outBytes > 0 && <Badge size="xs" variant="light" color="gray">{formatBytes(outBytes)}</Badge>}
              </Group>
              <Group gap={4}>
                <CopyButton value={outputValue || ''} icon />
                <DownloadButton data={outputValue || ''} filename={outputFilename || `output.${EXT[outputLanguage] || 'txt'}`} variant="subtle" size="compact-xs">
                  Download
                </DownloadButton>
              </Group>
            </Group>
            <CodeEditor value={outputValue || ''} language={outputLanguage} height={editorHeight} readOnly />
          </Paper>
        )}
      </div>

      {showOutput && (
        <Group justify="center" gap="sm">
          <Button onClick={process} loading={loading} leftSection={<IconPlayerPlay size={16} />} disabled={!inputValue?.trim()}
            rightSection={<Kbd size="xs">⌘↵</Kbd>}>
            {processLabel}
          </Button>
          <Button variant="light" leftSection={<IconArrowsExchange size={16} />}
            onClick={() => onInputChange(outputValue || '')} disabled={!outputValue}>
            Output → Input
          </Button>
          <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />}
            onClick={() => { onInputChange(''); onClear?.(); }}>
            Clear
          </Button>
        </Group>
      )}

      {statusText && (
        <Group justify="center">
          <Badge variant="light" color={error ? 'red' : 'teal'} size="lg" tt="none" style={{ maxWidth: '100%', height: 'auto', whiteSpace: 'normal', padding: '6px 12px' }}>
            {statusText}
          </Badge>
        </Group>
      )}
    </Stack>
  );
}
