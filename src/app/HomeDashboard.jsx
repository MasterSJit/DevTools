'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { TextInput, Badge, ActionIcon, Tooltip, SegmentedControl } from '@mantine/core';
import { IconSearch, IconStar, IconStarFilled, IconHistory, IconLock, IconBolt, IconShieldLock, IconX } from '@tabler/icons-react';
import { CATEGORIES, TOOLS, TOOL_MAP, toolPath, searchTools } from '@/constants/tools';
import { useFavoritesStore } from '@/shared/stores/favorites.store';
import { useToolHistoryStore } from '@/shared/stores/toolHistory.store';
import { useMounted } from '@/shared/hooks/useMounted';

function ToolCard({ tool, isFav, onToggleFav }) {
  const Icon = tool.icon;
  return (
    <Link
      href={toolPath(tool.id)}
      className="tool-card group relative flex gap-3 p-4 rounded-2xl no-underline border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-[0_12px_30px_-12px_rgba(79,70,229,0.25)] transition-all"
    >
      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/15 flex items-center justify-center shrink-0 transition-colors">
        <Icon size={20} className="text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors" />
      </div>
      <div className="min-w-0 flex-1 pr-5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{tool.label}</span>
          {tool.isNew && <Badge size="xs" color="teal" variant="light">New</Badge>}
        </div>
        <p className="m-0 mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">{tool.desc}</p>
      </div>
      <div className={`absolute top-3 right-3 ${isFav ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
        <Tooltip label={isFav ? 'Unfavorite' : 'Favorite'}>
          <ActionIcon
            variant="subtle"
            size="sm"
            color={isFav ? 'yellow' : 'gray'}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav(tool.id); }}
            aria-label="Toggle favorite"
          >
            {isFav ? <IconStarFilled size={14} /> : <IconStar size={14} />}
          </ActionIcon>
        </Tooltip>
      </div>
    </Link>
  );
}

export default function HomeDashboard() {
  const mounted = useMounted();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const { favorites, toggleFavorite } = useFavoritesStore();
  const history = useToolHistoryStore((s) => s.history);

  const results = useMemo(() => searchTools(query), [query]);
  const resultIds = useMemo(() => new Set(results.map((t) => t.id)), [results]);
  const favSet = new Set(mounted ? favorites : []);
  const recent = mounted ? history.map((h) => TOOL_MAP[h.id]).filter(Boolean).slice(0, 6) : [];
  const securityCount = TOOLS.filter((t) => t.category === 'security').length;

  const card = (t) => <ToolCard key={t.id} tool={t} isFav={favSet.has(t.id)} onToggleFav={toggleFavorite} />;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-indigo-500/10 dark:via-slate-900/40 dark:to-cyan-500/5 p-6 md:p-10">
        <div className="max-w-2xl">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="light" leftSection={<IconLock size={11} />}>100% client-side</Badge>
            <Badge variant="light" color="red" leftSection={<IconShieldLock size={11} />}>{securityCount} security tools</Badge>
            <Badge variant="light" color="teal" leftSection={<IconBolt size={11} />}>No sign-up</Badge>
          </div>
          <h1 className="m-0 text-3xl md:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
            {TOOLS.length} developer &amp; security tools.
            <span className="block text-indigo-600 dark:text-indigo-400">Zero uploads.</span>
          </h1>
          <p className="mt-3 mb-6 text-sm md:text-base text-slate-600 dark:text-slate-400">
            Format code, decode tokens, hash files, generate keys, inspect certificates and more — your data never leaves this tab.
          </p>
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="What do you need? e.g. “jwt”, “sha256”, “aes”, “cron”…"
            size="md"
            radius="xl"
            leftSection={<IconSearch size={18} />}
            rightSection={query ? <IconX size={16} className="cursor-pointer" onClick={() => setQuery('')} /> : null}
            autoFocus
          />
        </div>
      </section>

      {/* Favorites & recent */}
      {!query && favSet.size > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
            <IconStarFilled size={12} className="text-amber-500" /> Favorites
          </h3>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {favorites.map((id) => TOOL_MAP[id]).filter(Boolean).map(card)}
          </div>
        </section>
      )}

      {!query && recent.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
            <IconHistory size={12} /> Recently used
          </h3>
          <div className="flex flex-wrap gap-2">
            {recent.map((t) => (
              <Link key={t.id} href={toolPath(t.id)}
                className="no-underline flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors">
                <t.icon size={14} /> {t.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Category filter */}
      {!query && (
        <div className="max-w-full overflow-x-auto">
          <SegmentedControl
            value={cat}
            onChange={setCat}
            radius="xl"
            size="xs"
            data={[{ value: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.label }))]}
          />
        </div>
      )}

      {/* Tool grid */}
      {query ? (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
            {results.length} result{results.length === 1 ? '' : 's'}
          </h3>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {results.map(card)}
          </div>
          {results.length === 0 && <p className="text-sm text-slate-500">No tools match “{query}”.</p>}
        </section>
      ) : (
        CATEGORIES.filter((c) => cat === 'all' || c.id === cat).map((c) => {
          const tools = TOOLS.filter((t) => t.category === c.id && resultIds.has(t.id));
          return (
            <section key={c.id}>
              <div className="flex items-baseline gap-3 mb-3">
                <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <c.icon size={16} className="text-indigo-500" /> {c.label}
                  <span className="text-xs font-medium text-slate-400">{tools.length}</span>
                </h3>
                <span className="hidden md:inline text-xs text-slate-400">{c.desc}</span>
              </div>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {tools.map(card)}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
