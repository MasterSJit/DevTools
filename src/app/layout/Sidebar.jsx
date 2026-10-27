'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { IconCode, IconStarFilled, IconX, IconChevronDown, IconSearch, IconHome, IconLock } from '@tabler/icons-react';
import { ScrollArea, ActionIcon, TextInput } from '@mantine/core';
import { CATEGORIES, TOOLS, TOOL_MAP, toolPath, searchTools } from '@/constants/tools';
import { useFavoritesStore } from '@/shared/stores/favorites.store';
import { useSidebarStore } from '@/shared/stores/sidebar.store';
import { useMounted } from '@/shared/hooks/useMounted';

function NavLink({ href, icon: Icon, label, active, isNew, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`relative flex items-center gap-3 px-3 py-2 rounded-xl transition-colors interactive group no-underline ${
        active
          ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
      }`}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-600 dark:bg-indigo-400 rounded-r-full"
          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
        />
      )}
      <Icon
        className={`w-4 h-4 shrink-0 ${
          active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500 group-hover:scale-110 transition-transform'
        }`}
      />
      <span className="text-[13px] font-medium truncate">{label}</span>
      {isNew && (
        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          New
        </span>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const mounted = useMounted();
  const favorites = useFavoritesStore((s) => s.favorites);
  const isOpen = useSidebarStore((s) => s.isOpen);
  const closeSidebar = useSidebarStore((s) => s.close);
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState({});

  const filtered = useMemo(() => new Set(searchTools(filter).map((t) => t.id)), [filter]);
  const favoriteTools = mounted ? favorites.map((id) => TOOL_MAP[id]).filter(Boolean) : [];

  const renderTool = (tool, keyPrefix = '') => (
    <NavLink
      key={keyPrefix + tool.id}
      href={toolPath(tool.id)}
      icon={tool.icon}
      label={tool.label}
      isNew={tool.isNew}
      active={pathname === toolPath(tool.id)}
      onClick={closeSidebar}
    />
  );

  return (
    <aside
      className={`fixed inset-y-0 left-0 w-72 h-full bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-5 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:transform-none lg:transition-none lg:flex lg:w-64 lg:h-full lg:bg-transparent lg:dark:bg-transparent lg:border-r-0 lg:p-0 lg:py-2 flex flex-col shrink-0 select-none ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Brand */}
      <div className="flex items-center justify-between mb-5 pl-2">
        <Link href="/" onClick={closeSidebar} className="flex items-center gap-3 cursor-pointer interactive no-underline">
          <div className="w-8 h-8 bg-slate-950 dark:bg-white rounded-lg flex items-center justify-center">
            <IconCode className="w-4 h-4 text-white dark:text-black" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
              DevForge<span className="text-indigo-500">.</span>
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{TOOLS.length} tools · offline-first</div>
          </div>
        </Link>
        <div className="lg:hidden">
          <ActionIcon variant="subtle" size="md" onClick={closeSidebar} aria-label="Close menu" color="gray">
            <IconX size={18} />
          </ActionIcon>
        </div>
      </div>

      <TextInput
        value={filter}
        onChange={(e) => setFilter(e.currentTarget.value)}
        placeholder="Filter tools…"
        size="xs"
        radius="md"
        leftSection={<IconSearch size={14} />}
        rightSection={filter ? <IconX size={12} className="cursor-pointer" onClick={() => setFilter('')} /> : null}
        mb="sm"
        mx={4}
      />

      <ScrollArea className="flex-1 -mx-2 px-2" type="hover" scrollbarSize={6}>
        <div className="space-y-4 pb-4">
          {!filter && (
            <NavLink href="/" icon={IconHome} label="All tools" active={pathname === '/'} onClick={closeSidebar} />
          )}

          {!filter && favoriteTools.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5 pl-3">
                <IconStarFilled size={10} className="text-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Favorites</span>
              </div>
              <div className="space-y-0.5">{favoriteTools.map((t) => renderTool(t, 'fav-'))}</div>
            </div>
          )}

          {CATEGORIES.map((cat) => {
            const tools = TOOLS.filter((t) => t.category === cat.id && filtered.has(t.id));
            if (!tools.length) return null;
            const isCollapsed = !filter && collapsed[cat.id];
            return (
              <div key={cat.id}>
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))}
                  className="w-full flex items-center gap-2 mb-1.5 pl-3 pr-2 bg-transparent border-0 cursor-pointer interactive text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <cat.icon size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{cat.label}</span>
                  <span className="text-[10px] font-semibold opacity-60">{tools.length}</span>
                  <IconChevronDown size={12} className={`ml-auto transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                </button>
                {!isCollapsed && <div className="space-y-0.5">{tools.map((t) => renderTool(t))}</div>}
              </div>
            );
          })}

          {filter && filtered.size === 0 && (
            <div className="text-xs text-slate-400 text-center py-6">No tools match “{filter}”</div>
          )}
        </div>
      </ScrollArea>

      <div className="mt-2 mx-1 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800">
        <IconLock size={13} className="text-emerald-500 shrink-0" />
        <span>Processed locally — nothing is uploaded.</span>
      </div>
    </aside>
  );
}
