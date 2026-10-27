'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import BackgroundEffects from '@/shared/components/BackgroundEffects';
import CustomCursor from '@/shared/components/CustomCursor';
import PageLoader from '@/shared/components/PageLoader';
import { useSidebarStore } from '@/shared/stores/sidebar.store';
import { usePrefsStore } from '@/shared/stores/prefs.store';
import { useMounted } from '@/shared/hooks/useMounted';

export default function MainLayout({ children }) {
  const pathname = usePathname();
  const mounted = useMounted();
  const isOpen = useSidebarStore((s) => s.isOpen);
  const closeSidebar = useSidebarStore((s) => s.close);
  const { fancyCursor, introAnimation, backgroundEffects } = usePrefsStore();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 overflow-hidden">
      {mounted && fancyCursor && <CustomCursor />}
      {mounted && introAnimation && <PageLoader />}

      <div className="flex h-screen p-0 lg:p-4 gap-0 lg:gap-4 relative">
        {mounted && backgroundEffects && <BackgroundEffects />}

        {/* Backdrop overlay for mobile drawer */}
        {isOpen && (
          <div
            onClick={closeSidebar}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          />
        )}

        <Sidebar />

        <main className="flex-1 min-w-0 h-full flex flex-col bg-white dark:bg-slate-900/60 backdrop-blur-md rounded-none lg:rounded-3xl shadow-none lg:shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-0 lg:border border-slate-200/70 dark:border-slate-800/70 overflow-hidden relative z-10">
          <Header />

          <div id="df-scroll" className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div key={pathname} className="page-transition-wrapper max-w-[1600px] mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
