import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set) => ({
      colorScheme: 'system',
      setColorScheme: (scheme) => set({ colorScheme: scheme }),
      toggleColorScheme: () =>
        set((state) => {
          const next =
            state.colorScheme === 'light'
              ? 'dark'
              : state.colorScheme === 'dark'
              ? 'system'
              : 'light';
          return { colorScheme: next };
        }),
    }),
    { name: 'devforge-theme' }
  )
);