'use client';

import { Paper, Group, Text, Textarea, Table, Badge, ThemeIcon, Stack } from '@mantine/core';
import {
  IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconCircleX, IconAlertOctagon,
} from '@tabler/icons-react';
import CopyButton from './CopyButton';
import DownloadButton from './DownloadButton';
import FileDropZone from './FileDropZone';

/** Bordered section with an optional title row and right-side actions. */
export function Panel({ title, icon: Icon, actions, children, p = 'md', ...rest }) {
  return (
    <Paper p={p} {...rest}>
      {(title || actions) && (
        <Group justify="space-between" mb="sm" gap="xs" wrap="nowrap">
          {title ? (
            <Group gap={8} wrap="nowrap">
              {Icon && <Icon size={16} className="text-indigo-500 shrink-0" />}
              <Text size="sm" fw={600}>{title}</Text>
            </Group>
          ) : <span />}
          {actions && <Group gap={6} wrap="nowrap">{actions}</Group>}
        </Group>
      )}
      {children}
    </Paper>
  );
}

/** Monospace input with optional "load from file". */
export function InputArea({ label = 'Input', value, onChange, placeholder, minRows = 6, maxRows = 18, onFile, actions, error }) {
  return (
    <Panel
      p="xs"
      title={label}
      actions={<>
        {actions}
        {onFile !== false && <FileDropZone compact onFile={(f) => (onFile ? onFile(f) : f.text().then(onChange))} />}
      </>}
    >
      <Textarea
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder}
        autosize
        minRows={minRows}
        maxRows={maxRows}
        className="code-font"
        error={error}
        spellCheck={false}
      />
    </Panel>
  );
}

/** Read-only monospace output with copy + download. */
export function OutputArea({ label = 'Output', value, filename = 'output.txt', minRows = 6, maxRows = 18, actions, mimeType }) {
  return (
    <Panel
      p="xs"
      title={label}
      actions={<>
        {actions}
        <CopyButton value={value || ''} icon />
        <DownloadButton data={value || ''} filename={filename} mimeType={mimeType} variant="subtle" size="compact-xs" />
      </>}
    >
      <Textarea value={value || ''} readOnly autosize minRows={minRows} maxRows={maxRows} className="code-font" spellCheck={false} />
    </Panel>
  );
}

/** Two-column label/value table where every value can be copied. */
export function KVTable({ rows, labelWidth = 180 }) {
  return (
    <Table verticalSpacing={6} horizontalSpacing="sm" striped highlightOnHover withRowBorders={false}>
      <Table.Tbody>
        {rows.filter(Boolean).map(([label, value, opts = {}], i) => (
          <Table.Tr key={i}>
            <Table.Td style={{ width: labelWidth, verticalAlign: 'top' }}>
              {typeof label === 'string' ? <Text size="xs" c="dimmed" fw={500}>{label}</Text> : label}
            </Table.Td>
            <Table.Td style={{ wordBreak: 'break-all' }}>
              {typeof value === 'string' || typeof value === 'number' ? (
                <Text size="sm" ff={opts.mono === false ? undefined : 'monospace'} c={opts.color}>{String(value)}</Text>
              ) : value}
            </Table.Td>
            <Table.Td style={{ width: 36 }}>
              {opts.copy !== false && (typeof value === 'string' || typeof value === 'number') && String(value) !== '' && (
                <CopyButton value={String(value)} icon />
              )}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

const LEVELS = {
  critical: { color: 'red', icon: IconAlertOctagon, label: 'Critical' },
  high: { color: 'red', icon: IconCircleX, label: 'High' },
  medium: { color: 'orange', icon: IconAlertTriangle, label: 'Medium' },
  low: { color: 'yellow', icon: IconAlertTriangle, label: 'Low' },
  info: { color: 'blue', icon: IconInfoCircle, label: 'Info' },
  pass: { color: 'teal', icon: IconCircleCheck, label: 'Pass' },
};

/** A single security finding row: severity icon, title and detail text. */
export function Finding({ level = 'info', title, children }) {
  const l = LEVELS[level] || LEVELS.info;
  const Icon = l.icon;
  return (
    <Group align="flex-start" gap="sm" wrap="nowrap" py={6}>
      <ThemeIcon size="sm" variant="light" color={l.color} radius="xl" mt={2}><Icon size={13} /></ThemeIcon>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Group gap={6}>
          <Text size="sm" fw={600}>{title}</Text>
          <Badge size="xs" variant="light" color={l.color}>{l.label}</Badge>
        </Group>
        {children && <Text size="xs" c="dimmed" mt={2} style={{ wordBreak: 'break-word' }}>{children}</Text>}
      </div>
    </Group>
  );
}

export function FindingList({ findings, empty = 'No issues found.' }) {
  if (!findings?.length) return <Text size="sm" c="dimmed">{empty}</Text>;
  const order = ['critical', 'high', 'medium', 'low', 'info', 'pass'];
  const sorted = [...findings].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
  return (
    <Stack gap={0}>
      {sorted.map((f, i) => <Finding key={i} level={f.level} title={f.title}>{f.detail}</Finding>)}
    </Stack>
  );
}

const GRADE_COLORS = { 'A+': 'teal', A: 'teal', B: 'lime', C: 'yellow', D: 'orange', E: 'red', F: 'red' };

/** Big letter grade badge used by analyzers. */
export function Grade({ grade, label }) {
  const color = GRADE_COLORS[grade] || 'gray';
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold"
        style={{ background: `var(--mantine-color-${color}-light)`, color: `var(--mantine-color-${color}-light-color)` }}
      >
        {grade}
      </div>
      {label && <Text size="sm" c="dimmed">{label}</Text>}
    </div>
  );
}

/** Small stat tile: big number + caption. */
export function Stat({ label, value, color }) {
  return (
    <Paper p="sm">
      <Text size="xs" c="dimmed" fw={500}>{label}</Text>
      <Text size="lg" fw={700} c={color} ff="monospace" style={{ wordBreak: 'break-all' }}>{value}</Text>
    </Paper>
  );
}

/** Small note telling users that a tool runs locally (or when it doesn't). */
export function PrivacyNote({ children, color = 'teal' }) {
  return (
    <Text size="xs" c={color === 'teal' ? 'dimmed' : color}>
      {children || 'Runs entirely in your browser — nothing is sent to a server.'}
    </Text>
  );
}
