// Load Monaco from our own origin (copied by scripts/copy-monaco.mjs) instead of cdn.jsdelivr.net.
export const loadMonaco = () => import('@monaco-editor/react').then((m) => {
  m.loader.config({ paths: { vs: '/monaco/vs' } });
  return m;
});
