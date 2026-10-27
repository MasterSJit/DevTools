import { diffLines, createTwoFilesPatch } from 'diff';

// Computes change stats and a unified .patch off the main thread (large inputs stay responsive).
self.onmessage = function (e) {
  const { original, modified, options = {} } = e.data;
  const { ignoreWhitespace = false, ignoreCase = false, context = 3 } = options;

  let orig = original;
  let mod = modified;
  if (ignoreCase) { orig = orig.toLowerCase(); mod = mod.toLowerCase(); }

  const parts = diffLines(orig, mod, { ignoreWhitespace });
  const stats = { added: 0, removed: 0, unchanged: 0, hunks: 0 };
  let inChange = false;
  for (const p of parts) {
    const n = p.count ?? p.value.split('\n').length - 1;
    if (p.added) stats.added += n;
    else if (p.removed) stats.removed += n;
    else stats.unchanged += n;
    if ((p.added || p.removed) && !inChange) stats.hunks++;
    inChange = !!(p.added || p.removed);
  }
  const total = stats.unchanged + Math.max(stats.added, stats.removed);
  stats.percentChanged = total ? Math.round((Math.max(stats.added, stats.removed) / total) * 100) : 0;

  const patch = createTwoFilesPatch('original', 'modified', original, modified, '', '', { context, ignoreWhitespace });
  self.postMessage({ stats, patch, identical: stats.added === 0 && stats.removed === 0 });
};
