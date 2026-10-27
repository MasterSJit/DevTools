import { useEffect, useState } from 'react';
import { useThemeStore } from '@/shared/stores/theme.store';

const systemScheme = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/** Returns 'light' | 'dark', following the OS when the user picked "system". */
export function useResolvedScheme() {
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const [system, setSystem] = useState('dark');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystem(systemScheme());
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return colorScheme === 'system' ? system : colorScheme;
}
