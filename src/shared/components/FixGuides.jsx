'use client';

import { useState } from 'react';
import { Accordion, Badge, Code, Group, List, SegmentedControl, Stack, Tabs, Text } from '@mantine/core';
import { IconTool } from '@tabler/icons-react';
import CopyButton from './CopyButton';
import { Panel } from './ui';
import { FIX_GUIDES, PLATFORMS } from '@/shared/lib/fixGuides';

const ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const COLORS = { critical: 'red', high: 'red', medium: 'orange', low: 'yellow', info: 'blue' };
const PLATFORM_KEY = 'devforge-fix-platform';

function Snippets({ snippets, platform }) {
  if (!snippets.length) return null;
  const preferred = snippets.find(([p]) => p === platform)?.[0] || snippets[0][0];
  return (
    <Tabs defaultValue={preferred} key={preferred} variant="outline" mt="sm">
      <Tabs.List>{snippets.map(([p]) => <Tabs.Tab key={p} value={p}>{p}</Tabs.Tab>)}</Tabs.List>
      {snippets.map(([p, , code]) => (
        <Tabs.Panel key={p} value={p} pt="xs">
          <div className="relative">
            <div className="absolute right-2 top-2 z-10"><CopyButton value={code} icon /></div>
            <Code block style={{ whiteSpace: 'pre-wrap', paddingRight: 40 }}>{code}</Code>
          </div>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

/** Collects the `fix` ids of non-passing findings and renders their step-by-step guides. */
export default function FixGuides({ findings, title = 'How to fix — step by step' }) {
  const [platform, setPlatform] = useState(() => { try { return localStorage.getItem(PLATFORM_KEY) || 'Nginx'; } catch { return 'Nginx'; } });
  const needed = new Map();
  for (const f of findings || []) {
    if (!f.fix || f.level === 'pass' || !FIX_GUIDES[f.fix]) continue;
    const prev = needed.get(f.fix);
    if (!prev || ORDER.indexOf(f.level) < ORDER.indexOf(prev)) needed.set(f.fix, f.level);
  }
  if (!needed.size) return null;
  const list = [...needed].sort((a, b) => ORDER.indexOf(a[1]) - ORDER.indexOf(b[1]));

  const choose = (p) => { setPlatform(p); try { localStorage.setItem(PLATFORM_KEY, p); } catch {} };

  return (
    <Panel title={title} icon={IconTool} actions={
      <SegmentedControl size="xs" value={platform} onChange={choose} data={PLATFORMS.filter((p) => p !== 'DNS')} />
    }>
      <Text size="xs" c="dimmed" mb="sm">Ordered by severity. Pick your server above — every guide opens on matching config you can copy.</Text>
      <Accordion variant="separated" multiple defaultValue={[list[0][0]]}>
        {list.map(([id, level]) => {
          const g = FIX_GUIDES[id];
          return (
            <Accordion.Item key={id} value={id}>
              <Accordion.Control>
                <Group gap="xs" wrap="nowrap">
                  <Badge size="xs" color={COLORS[level]} variant="light">{level}</Badge>
                  <Text size="sm" fw={600}>{g.title}</Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap={6}>
                  <Text size="sm" c="dimmed">{g.why}</Text>
                  <List type="ordered" size="sm" spacing={4}>
                    {g.steps.map((s, i) => <List.Item key={i}>{s}</List.Item>)}
                  </List>
                  <Snippets snippets={g.snippets} platform={platform} />
                  {g.verify && <Text size="xs" c="dimmed" mt={4}>Verify: <Code>{g.verify}</Code></Text>}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </Panel>
  );
}
