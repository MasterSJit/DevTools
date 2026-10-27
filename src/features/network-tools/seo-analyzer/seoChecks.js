// On-page SEO, performance and best-practice checks over fetched HTML + response metadata.
// The HTML is parsed with DOMParser, which never runs scripts or loads sub-resources.

const PENALTY = { critical: 25, high: 15, medium: 8, low: 3, info: 0, pass: 0 };

function bucket() {
  const findings = [];
  return {
    findings,
    add(level, title, detail, fix) { findings.push({ level, title, detail: [detail, fix && `Fix: ${fix}`].filter(Boolean).join(' — ') }); },
    score() { return Math.max(0, 100 - findings.reduce((n, f) => n + PENALTY[f.level], 0)); },
  };
}

const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const meta = (doc, sel) => doc.querySelector(sel)?.getAttribute('content')?.trim() || '';
const header = (headers, name) => headers.filter(([k]) => k.toLowerCase() === name).map(([, v]) => v).join(', ');

export function analyzeSeo({ html, url, status = 200, headers = [], ttfbMs = null, bodyBytes = null, redirects = [], robotsTxt = null, sitemap = null }) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Pristine copy: `doc` gets scripts stripped below for word counting.
  const doc2 = new DOMParser().parseFromString(html, 'text/html');
  const base = new URL(url);
  const seo = bucket(), perf = bucket(), best = bucket(), social = bucket();

  // ── Meta ──
  const title = text(doc.querySelector('title'));
  const description = meta(doc, 'meta[name="description" i]');
  const canonical = doc.querySelector('link[rel="canonical" i]')?.getAttribute('href') || '';
  const robotsMeta = meta(doc, 'meta[name="robots" i]').toLowerCase();
  const xRobots = header(headers, 'x-robots-tag').toLowerCase();
  const lang = doc.documentElement.getAttribute('lang') || '';
  const viewport = meta(doc, 'meta[name="viewport" i]');
  const charset = doc.querySelector('meta[charset]') || doc.querySelector('meta[http-equiv="content-type" i]');
  const hreflang = [...doc.querySelectorAll('link[rel="alternate" i][hreflang]')].map((l) => `${l.getAttribute('hreflang')} → ${l.getAttribute('href')}`);
  const favicon = doc.querySelector('link[rel~="icon" i]');

  if (status >= 400) seo.add('critical', `Page returns HTTP ${status}`, 'Search engines drop pages that return errors.');
  if (!title) seo.add('high', 'Missing <title>', 'The title is the clickable headline in search results.', 'Add a unique, descriptive title of 30–60 characters.');
  else if (title.length < 30) seo.add('low', `Title is short (${title.length} chars)`, `“${title}”`, 'Aim for 30–60 characters including the main keyword.');
  else if (title.length > 60) seo.add('low', `Title may be truncated (${title.length} chars)`, `“${title}”`, 'Keep it under ~60 characters so it is not cut off in results.');
  else seo.add('pass', `Title length is good (${title.length} chars)`);

  if (!description) seo.add('medium', 'Missing meta description', 'Google will invent a snippet from page text.', 'Add <meta name="description"> with 70–160 characters.');
  else if (description.length < 70) seo.add('low', `Meta description is short (${description.length} chars)`);
  else if (description.length > 160) seo.add('low', `Meta description may be truncated (${description.length} chars)`);
  else seo.add('pass', `Meta description length is good (${description.length} chars)`);

  if (/noindex/.test(robotsMeta) || /noindex/.test(xRobots)) seo.add('critical', 'Page is set to noindex', `${robotsMeta ? `meta robots="${robotsMeta}"` : ''} ${xRobots ? `X-Robots-Tag: ${xRobots}` : ''}`.trim(), 'Remove noindex if this page should appear in search.');
  if (/nofollow/.test(robotsMeta)) seo.add('medium', 'Links on this page are nofollow', `meta robots="${robotsMeta}"`);

  if (!canonical) seo.add('low', 'No canonical URL', 'Duplicate URLs (tracking params, http/https, trailing slash) can split ranking signals.', 'Add <link rel="canonical" href="…">.');
  else {
    try {
      const c = new URL(canonical, base);
      if (c.href.replace(/\/$/, '') !== base.href.split('#')[0].replace(/\/$/, '')) seo.add('info', 'Canonical points to a different URL', c.href);
      else seo.add('pass', 'Canonical URL set');
    } catch { seo.add('medium', 'Invalid canonical URL', canonical); }
  }
  if (!lang) seo.add('low', 'Missing <html lang>', 'Helps search engines and screen readers pick the right language.', 'Add lang="en" (or your language) to <html>.');
  if (!viewport) seo.add('high', 'No viewport meta tag', 'The page will not be treated as mobile-friendly.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.');
  if (!charset) best.add('low', 'No charset declared', null, 'Add <meta charset="utf-8"> as the first element in <head>.');
  if (!favicon) best.add('low', 'No favicon link', 'Favicons appear next to results in mobile search.');
  if (!/^<!doctype html>/i.test(html.trim())) best.add('low', 'Missing <!DOCTYPE html>', 'Without it the browser renders in quirks mode.');

  // ── Headings & content ──
  const headings = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({ level: Number(h.tagName[1]), text: text(h).slice(0, 120) }));
  const h1s = headings.filter((h) => h.level === 1);
  if (!h1s.length) seo.add('high', 'No <h1> heading', 'The H1 tells search engines what the page is about.', 'Add exactly one H1 with the main topic.');
  else if (h1s.length > 1) seo.add('low', `${h1s.length} <h1> headings`, h1s.map((h) => h.text).join(' | '), 'Use a single H1 and H2–H6 for sections.');
  else seo.add('pass', 'One <h1> heading', h1s[0].text);
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) { seo.add('low', 'Heading levels are skipped', `H${headings[i - 1].level} is followed by H${headings[i].level} (“${headings[i].text}”).`); break; }
  }
  doc.querySelectorAll('script,style,noscript,template,svg').forEach((n) => n.remove());
  const bodyText = text(doc.body);
  const words = bodyText ? bodyText.split(' ').length : 0;
  if (words < 300) seo.add('low', `Thin content (${words} words)`, 'Pages with little text rarely rank for competitive queries (single-page apps may render text with JavaScript).');

  // ── Images ──
  const images = [...doc.querySelectorAll('img')].map((img) => ({
    src: img.getAttribute('src') || img.getAttribute('data-src') || '',
    alt: img.getAttribute('alt'),
    sized: img.hasAttribute('width') && img.hasAttribute('height'),
    lazy: img.getAttribute('loading') === 'lazy',
  }));
  const noAlt = images.filter((i) => i.alt === null);
  if (noAlt.length) seo.add('medium', `${noAlt.length} of ${images.length} images have no alt text`, 'Alt text helps image search and accessibility.', 'Add descriptive alt="…" (alt="" for decorative images).');
  else if (images.length) seo.add('pass', `All ${images.length} images have alt attributes`);
  const unsized = images.filter((i) => !i.sized);
  if (unsized.length) perf.add('low', `${unsized.length} images without width/height`, 'Causes layout shift (CLS) while images load.', 'Set width and height attributes (or CSS aspect-ratio).');
  if (images.length > 6 && !images.some((i) => i.lazy)) perf.add('low', 'No lazy-loaded images', `${images.length} images load eagerly.`, 'Add loading="lazy" to below-the-fold images.');

  // ── Links ──
  const links = [...doc.querySelectorAll('a[href]')].map((a) => {
    const href = a.getAttribute('href');
    let abs = null;
    try { abs = new URL(href, base); } catch {}
    return { href, abs, text: text(a) || a.getAttribute('aria-label') || a.querySelector('img')?.getAttribute('alt') || '', rel: (a.getAttribute('rel') || '').toLowerCase(), blank: a.getAttribute('target') === '_blank' };
  }).filter((l) => l.abs && /^https?:$/.test(l.abs.protocol));
  const internal = links.filter((l) => l.abs.hostname === base.hostname);
  const external = links.filter((l) => l.abs.hostname !== base.hostname);
  const emptyText = links.filter((l) => !l.text);
  if (!internal.length) seo.add('low', 'No internal links', 'Internal links help crawlers discover the rest of the site.');
  if (emptyText.length) seo.add('low', `${emptyText.length} links have no anchor text`, 'Search engines use anchor text to understand the target page.');
  const unsafeBlank = links.filter((l) => l.blank && l.abs.hostname !== base.hostname && !/noopener|noreferrer/.test(l.rel));
  if (unsafeBlank.length) best.add('low', `${unsafeBlank.length} external target="_blank" links without rel="noopener"`, 'Older browsers let the opened page control yours (reverse tabnabbing).');

  // ── Structured data & social ──
  const ld = [...doc2.querySelectorAll('script[type="application/ld+json" i]')].map((s) => {
    try {
      const j = JSON.parse(s.textContent);
      const items = Array.isArray(j) ? j : j['@graph'] || [j];
      return { ok: true, types: items.map((x) => [].concat(x['@type'] || '?').join('/')) };
    } catch (e) { return { ok: false, error: e.message }; }
  });
  if (!ld.length) seo.add('low', 'No structured data (JSON-LD)', 'Schema.org markup enables rich results (stars, FAQs, breadcrumbs).', 'Add JSON-LD for your page type (Organization, Article, Product…).');
  else if (ld.some((x) => !x.ok)) seo.add('medium', 'Invalid JSON-LD block', ld.find((x) => !x.ok).error);
  else seo.add('pass', `Structured data: ${ld.flatMap((x) => x.types).join(', ')}`);

  const og = {
    title: meta(doc2, 'meta[property="og:title" i]'),
    description: meta(doc2, 'meta[property="og:description" i]'),
    image: meta(doc2, 'meta[property="og:image" i]'),
    url: meta(doc2, 'meta[property="og:url" i]'),
    type: meta(doc2, 'meta[property="og:type" i]'),
    siteName: meta(doc2, 'meta[property="og:site_name" i]'),
    twitterCard: meta(doc2, 'meta[name="twitter:card" i]'),
  };
  ['title', 'description', 'image', 'url'].forEach((k) => { if (!og[k]) social.add(k === 'image' ? 'medium' : 'low', `Missing og:${k}`, k === 'image' ? 'Shared links show no preview image on WhatsApp, LinkedIn, Facebook…' : null); });
  if (!og.twitterCard) social.add('low', 'Missing twitter:card', null, 'Add <meta name="twitter:card" content="summary_large_image">.');
  if (og.image) { try { new URL(og.image, base); social.add('pass', 'og:image set'); } catch { social.add('medium', 'og:image is not a valid URL'); } }

  // ── Performance (from the HTML and response) ──
  const head = doc2.head;
  const blockingScripts = [...head.querySelectorAll('script[src]')].filter((s) => !s.hasAttribute('async') && !s.hasAttribute('defer') && s.getAttribute('type') !== 'module');
  const stylesheets = [...head.querySelectorAll('link[rel="stylesheet" i]')];
  const scripts = [...doc2.querySelectorAll('script[src]')];
  const inlineScriptBytes = [...doc2.querySelectorAll('script:not([src])')].reduce((n, s) => n + s.textContent.length, 0);
  const size = bodyBytes ?? new Blob([html]).size;

  if (ttfbMs != null) {
    if (ttfbMs > 1800) perf.add('high', `Slow server response (TTFB ${ttfbMs} ms)`, 'Measured from Cloudflare’s edge.', 'Cache HTML at the CDN or speed up the backend (target < 800 ms).');
    else if (ttfbMs > 800) perf.add('medium', `Server response could be faster (TTFB ${ttfbMs} ms)`, null, 'Aim for under 800 ms.');
    else perf.add('pass', `Fast server response (TTFB ${ttfbMs} ms)`);
  }
  if (size > 1024 * 1024) perf.add('high', `Very large HTML (${Math.round(size / 1024)} KB)`, null, 'Remove inlined data/scripts; paginate long lists.');
  else if (size > 200 * 1024) perf.add('medium', `Large HTML (${Math.round(size / 1024)} KB)`);
  const enc = header(headers, 'content-encoding');
  if (headers.length) {
    if (!/gzip|br|zstd|deflate/i.test(enc)) perf.add('medium', 'HTML is not compressed', 'No Content-Encoding header.', 'Enable Brotli or gzip on the server/CDN.');
    else perf.add('pass', `Compressed with ${enc}`);
  }
  if (blockingScripts.length) perf.add('medium', `${blockingScripts.length} render-blocking script(s) in <head>`, blockingScripts.slice(0, 3).map((s) => s.getAttribute('src')).join(', '), 'Add defer (or async) to scripts that don’t need to run before first paint.');
  if (stylesheets.length > 4) perf.add('low', `${stylesheets.length} stylesheets in <head>`, null, 'Combine CSS files or inline critical CSS.');
  if (scripts.length > 20) perf.add('low', `${scripts.length} external scripts`, null, 'Each script costs download and parse time; audit third-party tags.');
  if (inlineScriptBytes > 100 * 1024) perf.add('low', `${Math.round(inlineScriptBytes / 1024)} KB of inline JavaScript`);
  if (redirects.length) perf.add(redirects.length > 1 ? 'medium' : 'info', `${redirects.length} redirect(s) before the page`, redirects.map((r) => `${r.status} ${r.url}`).join(' → '));
  const preconnects = head.querySelectorAll('link[rel="preconnect" i], link[rel="dns-prefetch" i]').length;
  const thirdPartyOrigins = new Set(scripts.map((s) => { try { return new URL(s.getAttribute('src'), base).origin; } catch { return null; } }).filter((o) => o && o !== base.origin));
  if (thirdPartyOrigins.size > 2 && !preconnects) perf.add('info', `${thirdPartyOrigins.size} third-party script origins without preconnect`, [...thirdPartyOrigins].slice(0, 4).join(', '));

  // ── Best practices ──
  if (base.protocol !== 'https:') best.add('high', 'Page is not served over HTTPS', 'HTTPS is a ranking signal and required for modern browser features.');
  else {
    const mixed = [...doc2.querySelectorAll('img[src^="http:" i], script[src^="http:" i], link[href^="http:" i][rel="stylesheet" i], iframe[src^="http:" i]')];
    if (mixed.length) best.add('high', `${mixed.length} mixed-content resource(s)`, mixed.slice(0, 3).map((m) => m.getAttribute('src') || m.getAttribute('href')).join(', '), 'Load every resource over https://.');
  }
  const cache = header(headers, 'cache-control');
  if (headers.length && !cache) best.add('info', 'No Cache-Control on the HTML');
  if (base.href.length > 100) seo.add('low', `Long URL (${base.href.length} chars)`);
  if (/[A-Z]/.test(base.pathname) || /_/.test(base.pathname)) seo.add('info', 'URL contains uppercase letters or underscores', 'Lowercase, hyphen-separated URLs are the convention.');

  // ── robots.txt / sitemap ──
  if (robotsTxt !== null) {
    if (robotsTxt === false) seo.add('low', 'No robots.txt', null, 'Add /robots.txt with a Sitemap: line.');
    else {
      const groups = robotsTxt.split(/\n(?=\s*user-agent)/i);
      const all = groups.find((g) => /user-agent:\s*\*/i.test(g)) || '';
      if (/^\s*disallow:\s*\/\s*$/im.test(all)) seo.add('critical', 'robots.txt blocks the whole site', 'User-agent: * has “Disallow: /”.');
      if (!/^\s*sitemap:/im.test(robotsTxt)) seo.add('low', 'robots.txt does not list a sitemap', null, 'Add “Sitemap: https://…/sitemap.xml”.');
      else seo.add('pass', 'robots.txt references a sitemap');
    }
  }
  if (sitemap !== null) {
    if (!sitemap) seo.add('low', 'No sitemap.xml found', null, 'Generate a sitemap and submit it in Google Search Console.');
    else seo.add('pass', `Sitemap found (${sitemap.urls} URLs${sitemap.index ? ', sitemap index' : ''})`);
  }

  const scores = { seo: seo.score(), performance: perf.score(), bestPractices: best.score(), social: social.score() };
  const overall = Math.round(scores.seo * 0.45 + scores.performance * 0.3 + scores.bestPractices * 0.15 + scores.social * 0.1);

  return {
    overall,
    scores,
    findings: { seo: seo.findings, performance: perf.findings, bestPractices: best.findings, social: social.findings },
    meta: { title, description, canonical, robots: robotsMeta || xRobots, lang, viewport, hreflang },
    og,
    headings,
    images: { total: images.length, missingAlt: noAlt.map((i) => i.src).slice(0, 50) },
    links: { internal: internal.length, external: external.length, nofollow: links.filter((l) => /nofollow/.test(l.rel)).length },
    structured: ld,
    stats: { words, sizeBytes: size, scripts: scripts.length, stylesheets: stylesheets.length, images: images.length },
  };
}

/** Counts <loc> entries of a sitemap or sitemap index. */
export function parseSitemap(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return null;
  const index = doc.getElementsByTagName('sitemapindex').length > 0;
  return { index, urls: doc.getElementsByTagName('loc').length };
}
