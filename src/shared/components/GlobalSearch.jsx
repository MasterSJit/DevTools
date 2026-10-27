'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Modal, TextInput, Text, Kbd, UnstyledButton, ScrollArea, ActionIcon, Badge } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSearch, IconCornerDownLeft } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { TOOLS, searchTools, toolPath, getCategory } from '@/constants/tools';

export default function GlobalSearch() {
  const [opened, { open, close }] = useDisclosure(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const router = useRouter();

  const results = useMemo(() => searchTools(query), [query]);

  const handleClose = useCallback(() => { close(); setQuery(''); setActive(0); }, [close]);

  const handleSelect = useCallback((tool) => {
    if (!tool) return;
    router.push(toolPath(tool.id));
    handleClose();
  }, [router, handleClose]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) {
        e.preventDefault();
        open();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); handleSelect(results[active]); }
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Search tools"
        className="interactive hidden md:flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-transparent px-3 py-1.5 min-w-[220px] cursor-pointer text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-colors"
      >
        <IconSearch size={15} stroke={1.8} />
        <Text size="sm" c="dimmed" style={{ flex: 1, textAlign: 'left' }}>Search tools…</Text>
        <Kbd size="xs">⌘K</Kbd>
      </button>
      <div className="md:hidden">
        <ActionIcon variant="subtle" size="lg" onClick={open} aria-label="Search tools" color="gray">
          <IconSearch size={18} />
        </ActionIcon>
      </div>

      <Modal opened={opened} onClose={handleClose} size="lg" withCloseButton={false} padding={0} radius="lg"
        yOffset="10vh" transitionProps={{ transition: 'pop', duration: 150 }}>
        <TextInput
          placeholder={`Search ${TOOLS.length} tools — try “jwt”, “hash”, “base64”, “dns”…`}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          leftSection={<IconSearch size={18} />}
          size="lg"
          variant="unstyled"
          px="md"
          py={6}
          data-autofocus
          styles={{ input: { fontSize: 16 } }}
          className="border-b border-slate-200 dark:border-slate-700/70"
        />
        <ScrollArea.Autosize mah={420} type="auto">
          <div ref={listRef} className="p-2">
            {results.map((tool, i) => {
              const cat = getCategory(tool.category);
              const Icon = tool.icon;
              const isActive = i === active;
              return (
                <UnstyledButton
                  key={tool.id}
                  data-index={i}
                  onClick={() => handleSelect(tool)}
                  onMouseMove={() => setActive(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Text size="sm" fw={600} truncate>{tool.label}</Text>
                      {tool.isNew && <Badge size="xs" color="teal" variant="light">New</Badge>}
                    </div>
                    <Text size="xs" c="dimmed" truncate>{tool.desc}</Text>
                  </div>
                  <div className="hidden sm:block shrink-0">
                    <Badge size="xs" variant="dot" color={cat?.color}>{cat?.label}</Badge>
                  </div>
                  {isActive && <IconCornerDownLeft size={14} className="text-slate-400 shrink-0" />}
                </UnstyledButton>
              );
            })}
            {results.length === 0 && (
              <Text c="dimmed" ta="center" py="xl" size="sm">No tools found for “{query}”</Text>
            )}
          </div>
        </ScrollArea.Autosize>
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-200 dark:border-slate-700/70 text-[11px] text-slate-400">
          <span><Kbd size="xs">↑</Kbd> <Kbd size="xs">↓</Kbd> navigate</span>
          <span><Kbd size="xs">↵</Kbd> open</span>
          <span><Kbd size="xs">esc</Kbd> close</span>
          <span className="ml-auto">Tip: press <Kbd size="xs">/</Kbd> anywhere</span>
        </div>
      </Modal>
    </>
  );
}
