'use client';

import React from 'react';
import { ActionIcon, Tooltip, Menu, Switch, Badge } from '@mantine/core';
import {
  IconSun, IconMoon, IconDeviceDesktop, IconMenu2, IconStar, IconStarFilled, IconSettings, IconLayoutGrid,
} from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import { getToolByPath, getCategory } from '@/constants/tools';
import { useThemeStore } from '@/shared/stores/theme.store';
import { useViewStore } from '@/shared/stores/view.store';
import { useSidebarStore } from '@/shared/stores/sidebar.store';
import { useFavoritesStore } from '@/shared/stores/favorites.store';
import { usePrefsStore } from '@/shared/stores/prefs.store';
import { useMounted } from '@/shared/hooks/useMounted';
import GlobalSearch from '@/shared/components/GlobalSearch';
import ViewToggle from '@/shared/components/ViewToggle';

export default function Header() {
  const pathname = usePathname();
  const mounted = useMounted();
  const { colorScheme, toggleColorScheme } = useThemeStore();
  const { viewMode, setViewMode } = useViewStore();
  const openSidebar = useSidebarStore((s) => s.open);
  const { favorites, toggleFavorite } = useFavoritesStore();
  const prefs = usePrefsStore();

  const tool = getToolByPath(pathname);
  const category = tool && getCategory(tool.category);
  const ToolIcon = tool?.icon || IconLayoutGrid;
  const isFav = mounted && tool && favorites.includes(tool.id);
  const scheme = mounted ? colorScheme : 'system';

  return (
    <header className="h-16 lg:h-[72px] border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 px-4 lg:px-8 shrink-0 select-none">
      <div className="flex items-center gap-3 min-w-0">
        {/* Tailwind utilities can't override Mantine's unlayered styles, so responsive visibility lives on wrappers. */}
        <div className="lg:hidden">
          <ActionIcon variant="subtle" size="lg" onClick={openSidebar} aria-label="Open menu" color="gray" radius="md">
            <IconMenu2 size={20} />
          </ActionIcon>
        </div>

        <div className="hidden sm:flex w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 items-center justify-center shrink-0">
          <ToolIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* The tool name is the page's H1; the home page has its own H1 in the hero. */}
            {tool ? (
              <h1 className="m-0 text-base md:text-lg font-semibold truncate text-slate-950 dark:text-slate-100">{tool.label}</h1>
            ) : (
              <div className="text-base md:text-lg font-semibold truncate text-slate-950 dark:text-slate-100">All Tools</div>
            )}
            {category && (
              <div className="hidden md:block shrink-0">
                <Badge size="xs" variant="light" color={category.color}>{category.label}</Badge>
              </div>
            )}
            {tool && (
              <Tooltip label={isFav ? 'Remove from favorites' : 'Add to favorites'}>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color={isFav ? 'yellow' : 'gray'}
                  onClick={() => toggleFavorite(tool.id)}
                  aria-label="Toggle favorite"
                >
                  {isFav ? <IconStarFilled size={15} /> : <IconStar size={15} />}
                </ActionIcon>
              </Tooltip>
            )}
          </div>
          <p className="m-0 text-[11px] md:text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[220px] sm:max-w-[420px] lg:max-w-[640px]">
            {tool?.desc || 'Developer & security tools that run entirely in your browser.'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        <GlobalSearch />

        {tool && (
          <div className="hidden md:block">
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        )}

        <Tooltip
          label={scheme === 'light' ? 'Light — switch to Dark' : scheme === 'dark' ? 'Dark — switch to System' : 'System — switch to Light'}
        >
          <ActionIcon variant="subtle" size="lg" onClick={toggleColorScheme} aria-label="Toggle theme" color="gray" radius="md">
            {scheme === 'light' ? <IconSun size={18} /> : scheme === 'dark' ? <IconMoon size={18} /> : <IconDeviceDesktop size={18} />}
          </ActionIcon>
        </Tooltip>

        <Menu position="bottom-end" width={240} shadow="md" closeOnItemClick={false}>
          <Menu.Target>
            <ActionIcon variant="subtle" size="lg" aria-label="Settings" color="gray" radius="md">
              <IconSettings size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Appearance</Menu.Label>
            <Menu.Item>
              <Switch size="xs" label="Intro animation" checked={mounted && prefs.introAnimation}
                onChange={(e) => prefs.setPref('introAnimation', e.currentTarget.checked)} />
            </Menu.Item>
            <Menu.Item>
              <Switch size="xs" label="Background effects" checked={mounted && prefs.backgroundEffects}
                onChange={(e) => prefs.setPref('backgroundEffects', e.currentTarget.checked)} />
            </Menu.Item>
            <Menu.Item>
              <Switch size="xs" label="Custom cursor" checked={mounted && prefs.fancyCursor}
                onChange={(e) => prefs.setPref('fancyCursor', e.currentTarget.checked)} />
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </header>
  );
}
