import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useFavoritesStore = create(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (toolId) => {
        const { favorites } = get();
        set({
          favorites: favorites.includes(toolId)
            ? favorites.filter((id) => id !== toolId)
            : [...favorites, toolId],
        });
      },
      isFavorite: (toolId) => get().favorites.includes(toolId),
    }),
    { name: 'devforge-favorites' }
  )
);