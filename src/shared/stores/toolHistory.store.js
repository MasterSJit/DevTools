import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useToolHistoryStore = create(
  persist(
    (set, get) => ({
      history: [],
      addToHistory: (toolId) => {
        const { history } = get();
        const filtered = history.filter((h) => h.id !== toolId);
        set({
          history: [{ id: toolId, timestamp: Date.now() }, ...filtered].slice(0, 20),
        });
      },
    }),
    { name: 'devforge-history' }
  )
);