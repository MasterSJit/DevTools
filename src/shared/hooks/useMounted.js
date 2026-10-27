import { useEffect, useState } from 'react';

/** True after the first client render — use to avoid hydration mismatches with persisted state. */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
