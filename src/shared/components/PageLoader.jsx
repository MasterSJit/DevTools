'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SESSION_KEY = 'devforge-intro-shown';

export default function PageLoader() {
  // Only play the intro once per browser session — not on every reload.
  const [isLoading, setIsLoading] = useState(() => {
    try { return !sessionStorage.getItem(SESSION_KEY); } catch { return false; }
  });

  useEffect(() => {
    if (!isLoading) return;
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
    const timer = setTimeout(() => setIsLoading(false), 700);
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: '-100%' }}
          transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[999] bg-slate-950 flex items-center justify-center"
        >
          <div className="overflow-hidden">
            <motion.h1
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '-100%' }}
              transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
              className="text-4xl md:text-6xl font-bold tracking-tighter text-white"
            >
              DevForge<span className="text-indigo-500">.</span>
            </motion.h1>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
