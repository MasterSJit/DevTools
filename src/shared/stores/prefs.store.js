import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Visual preferences. Heavy effects are opt-in so the tools stay fast.
export const usePrefsStore = create(
  persist(
    (set) => ({
      fancyCursor: false,
      introAnimation: true,
      backgroundEffects: true,
      setPref: (key, value) => set({ [key]: value }),
    }),
    { name: 'devforge-prefs' }
  )
);
