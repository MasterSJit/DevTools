'use client';

import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { Loader, Center, ActionIcon, Tooltip } from '@mantine/core';
import { IconMaximize, IconMinimize } from '@tabler/icons-react';
import { createPortal } from 'react-dom';
import { useResolvedScheme } from '@/shared/hooks/useResolvedScheme';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

export default function CodeEditor({
  value, onChange, language = 'plaintext', height = '350px',
  readOnly = false, minimap = false,
  wordWrap = 'on', fontSize = 13,
}) {
  const resolvedTheme = useResolvedScheme();
  const [mounted, setMounted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Esc leaves fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const options = {
    readOnly,
    minimap: { enabled: fullscreen ? true : minimap },
    wordWrap,
    fontSize: fullscreen ? 15 : fontSize,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    scrollBeyondLastLine: false,
    lineNumbersMinChars: 3,
    padding: { top: 10 },
    automaticLayout: true,
    bracketPairColorization: { enabled: true },
    tabSize: 2,
    renderLineHighlight: readOnly ? 'none' : 'line',
  };

  const toggleFullscreen = useCallback(() => setFullscreen((v) => !v), []);

  const editorContent = (
    <div
      className={fullscreen ? 'fixed inset-0 z-[9999]' : 'relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800'}
      style={fullscreen ? {
        background: resolvedTheme === 'dark' ? '#1e1e1e' : '#ffffff',
        width: '100vw',
        height: '100vh',
      } : {}}
    >
      <Tooltip label={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}>
        <ActionIcon
          variant="default"
          size="sm"
          onClick={toggleFullscreen}
          aria-label="Toggle fullscreen"
          style={{ position: 'absolute', top: fullscreen ? 16 : 6, right: fullscreen ? 16 : 18, zIndex: 100, opacity: 0.75 }}
        >
          {fullscreen ? <IconMinimize size={14} /> : <IconMaximize size={14} />}
        </ActionIcon>
      </Tooltip>
      <MonacoEditor
        height={fullscreen ? '100vh' : height}
        language={language}
        value={value}
        onChange={(v) => onChange?.(v ?? '')}
        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
        options={options}
        loading={<Loader size="sm" />}
      />
    </div>
  );

  const renderContainer = (
    <Suspense fallback={<Center h={height}><Loader size="sm" /></Center>}>
      {editorContent}
    </Suspense>
  );

  if (fullscreen && mounted) {
    return createPortal(renderContainer, window.document.body);
  }

  return renderContainer;
}
