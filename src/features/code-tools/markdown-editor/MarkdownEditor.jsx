import { useRef, useState, useEffect } from 'react';
import { Stack, Group, Paper, Text, ActionIcon, Tooltip, SegmentedControl, Divider, Badge } from '@mantine/core';
import {
  IconBold, IconItalic, IconCode, IconLink, IconPhoto, IconList, IconListNumbers, IconH1, IconH2, IconH3,
  IconStrikethrough, IconQuote, IconTable, IconListCheck, IconSeparator, IconSourceCode, IconFileTypeHtml,
} from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CopyButton from '@/shared/components/CopyButton';
import DownloadButton from '@/shared/components/DownloadButton';
import { downloadText } from '@/shared/lib/download';

const STORAGE_KEY = 'devforge-markdown-draft';

const DEFAULT_MD = `# Hello DevForge

This is a **live markdown editor** with GitHub-flavoured markdown.

## Features
- [x] Bold, *italic*, ~~strikethrough~~ and \`inline code\`
- [x] Tables and task lists
- [x] Export to \`.md\` or standalone \`.html\`
- [ ] Your next README

> Tip: your draft is saved in this browser automatically.

\`\`\`javascript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

| Feature | Status |
|---------|:------:|
| GFM     | ✅ |
| Export  | ✅ |
`;

// [icon, tooltip, before, after, placeholder, linePrefix?]
const ACTIONS = [
  [IconH1, 'Heading 1', '# ', '', 'Heading', true],
  [IconH2, 'Heading 2', '## ', '', 'Heading', true],
  [IconH3, 'Heading 3', '### ', '', 'Heading', true],
  null,
  [IconBold, 'Bold (⌘B)', '**', '**', 'bold text'],
  [IconItalic, 'Italic (⌘I)', '*', '*', 'italic text'],
  [IconStrikethrough, 'Strikethrough', '~~', '~~', 'text'],
  [IconCode, 'Inline code', '`', '`', 'code'],
  [IconSourceCode, 'Code block', '```\n', '\n```', 'code'],
  null,
  [IconList, 'Bullet list', '- ', '', 'item', true],
  [IconListNumbers, 'Numbered list', '1. ', '', 'item', true],
  [IconListCheck, 'Task list', '- [ ] ', '', 'task', true],
  [IconQuote, 'Quote', '> ', '', 'quote', true],
  null,
  [IconLink, 'Link (⌘K)', '[', '](https://)', 'link text'],
  [IconPhoto, 'Image', '![', '](https://)', 'alt text'],
  [IconTable, 'Table', '\n| Column | Column |\n|--------|--------|\n| ', ' | value  |\n', 'value'],
  [IconSeparator, 'Divider', '\n---\n', '', ''],
];

export default function MarkdownEditor() {
  const [input, setInput] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_MD; } catch { return DEFAULT_MD; }
  });
  // Local layout state — previously this overwrote the app-wide view store.
  const [mode, setMode] = useState('split');
  const taRef = useRef(null);
  const renderedRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, input); } catch {} }, 400);
    return () => clearTimeout(t);
  }, [input]);

  const insert = ([, , before, after, placeholder, linePrefix]) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const selected = value.slice(s, e) || placeholder;
    const atLineStart = linePrefix && s > 0 && value[s - 1] !== '\n' ? '\n' : '';
    const text = atLineStart + before + selected + after;
    const next = value.slice(0, s) + text + value.slice(e);
    setInput(next);
    requestAnimationFrame(() => {
      ta.focus();
      const start = s + atLineStart.length + before.length;
      ta.setSelectionRange(start, start + selected.length);
    });
  };

  const onKeyDown = (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const map = { b: ACTIONS[4], i: ACTIONS[5], k: ACTIONS[15] };
    const a = map[e.key.toLowerCase()];
    if (a) { e.preventDefault(); e.stopPropagation(); insert(a); }
  };

  const exportHtml = () => {
    const body = renderedRef.current?.innerHTML || '';
    const title = (input.match(/^#\s+(.+)$/m) || [])[1] || 'Document';
    downloadText(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.replace(/</g, '&lt;')}</title>
<style>body{font-family:system-ui,sans-serif;max-width:820px;margin:40px auto;padding:0 16px;line-height:1.65;color:#1f2937}pre{background:#f3f4f6;padding:14px;border-radius:8px;overflow:auto}code{background:#f3f4f6;padding:2px 5px;border-radius:4px}pre code{padding:0}table{border-collapse:collapse}th,td{border:1px solid #d1d5db;padding:6px 12px}blockquote{border-left:4px solid #6366f1;margin:0;padding-left:16px;color:#4b5563}img{max-width:100%}</style>
</head><body>
${body}
</body></html>`, 'document.html', 'text/html');
  };

  const words = (input.match(/\S+/g) || []).length;

  return (
    <Stack gap="md">
      <Paper p="xs">
        <Group justify="space-between" gap="xs">
          <Group gap={2}>
            {ACTIONS.map((a, i) => {
              if (a === null) return <Divider key={i} orientation="vertical" mx={4} />;
              const Icon = a[0];
              return (
                <Tooltip key={a[1]} label={a[1]}>
                  <ActionIcon variant="subtle" color="gray" onClick={() => insert(a)} aria-label={a[1]}><Icon size={16} /></ActionIcon>
                </Tooltip>
              );
            })}
          </Group>
          <Group gap="xs">
            <SegmentedControl size="xs" value={mode} onChange={setMode}
              data={[{ value: 'edit', label: 'Edit' }, { value: 'split', label: 'Split' }, { value: 'preview', label: 'Preview' }]} />
            <CopyButton value={input} icon />
            <DownloadButton data={input} filename="document.md" variant="subtle" size="compact-xs">.md</DownloadButton>
            <Tooltip label="Export standalone HTML">
              <ActionIcon variant="subtle" onClick={exportHtml} aria-label="Export HTML"><IconFileTypeHtml size={18} /></ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Paper>

      <div style={{ display: 'flex', gap: 'var(--mantine-spacing-md)', minHeight: 560 }}>
        {mode !== 'preview' && (
          <Paper p="xs" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              className="code-font"
              style={{
                flex: 1, width: '100%', minHeight: 540, border: 'none', outline: 'none', resize: 'none', padding: 8,
                fontSize: 14, lineHeight: 1.65, background: 'transparent', color: 'inherit',
              }}
            />
          </Paper>
        )}
        {/* Always rendered (hidden in edit mode) so HTML export can read the markup. */}
        <Paper p="lg" style={{ flex: 1, minWidth: 0, overflow: 'auto', maxHeight: 640, display: mode === 'edit' ? 'none' : undefined }}>
          <div className="markdown-body" ref={renderedRef}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{input}</ReactMarkdown>
          </div>
        </Paper>
      </div>
      <Group gap="xs">
        <Badge variant="light" color="gray">{words.toLocaleString()} words</Badge>
        <Badge variant="light" color="gray">{input.length.toLocaleString()} characters</Badge>
        <Badge variant="light" color="gray">~{Math.max(1, Math.round(words / 230))} min read</Badge>
        <Text size="xs" c="dimmed">Draft auto-saved in this browser. Raw HTML in markdown is not rendered (XSS-safe).</Text>
      </Group>
    </Stack>
  );
}
