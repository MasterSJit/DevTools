import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Global input/output layout: 'horizontal' (side by side) or 'vertical' (stacked).
export const useViewStore = create(
  persist(
    (set) => ({
      viewMode: 'horizontal',
      setViewMode: (mode) => set({ viewMode: mode === 'vertical' ? 'vertical' : 'horizontal' }),
      toggleViewMode: () =>
        set((state) => ({
          viewMode: state.viewMode === 'horizontal' ? 'vertical' : 'horizontal',
        })),
    }),
    {
      name: 'devforge-view-mode',
      version: 1,
      // Older builds let the Diff Viewer / Markdown Editor write other values into this store.
      migrate: (state) => ({ ...state, viewMode: state?.viewMode === 'vertical' ? 'vertical' : 'horizontal' }),
    }
  )
);
