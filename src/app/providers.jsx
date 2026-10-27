'use client';

import { useEffect } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { useResolvedScheme } from '@/shared/hooks/useResolvedScheme';

const theme = createTheme({
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', 'Fira Code', monospace",
  primaryColor: 'indigo',
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Button: {
      defaultProps: {
        loaderProps: { type: 'dots' },
      },
    },
    Card: {
      defaultProps: {
        shadow: 'sm',
        withBorder: true,
      },
    },
    Paper: {
      defaultProps: {
        withBorder: true,
      },
      classNames: {
        root: 'df-panel',
      },
    },
  },
});

export default function Providers({ children }) {
  const resolved = useResolvedScheme();

  // Keep Tailwind's `dark` class in sync with Mantine's color scheme.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
  }, [resolved]);

  return (
    <MantineProvider theme={theme} forceColorScheme={resolved}>
      <Notifications position="top-right" />
      {children}
    </MantineProvider>
  );
}
