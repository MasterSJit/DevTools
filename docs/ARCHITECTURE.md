# Architecture

DevForge is a Next.js 14 app-router project that is exported as a static site. Every tool is a client-side React component; the server (Apache or any static host) only serves files. A small Cloudflare Worker covers the few things browsers cannot do.

```
Browser ──► static HTML/JS (out/, served by Apache via Cloudflare)
   │
   ├─► Web Crypto / WASM / Web Workers         (almost every tool)
   ├─► public APIs with CORS                   (DoH DNS, RDAP, crt.sh, Cert Spotter, HIBP, PageSpeed)
   └─► /api/* ──► Cloudflare Worker (proxy/)    (other sites' headers/HTML, port-43 WHOIS)
```

## Directory layout

```
src/
  app/
    layout.jsx              Root layout: metadata, theme bootstrap script, fonts, Providers + MainLayout
    providers.jsx           MantineProvider with the resolved light/dark scheme; syncs Tailwind's `dark` class
    page.jsx, HomeDashboard.jsx   Home: hero search, favorites, recently used, category grid
    not-found.jsx           404 page
    robots.js, sitemap.js   Generated at build time from the tool registry
    layout/                 MainLayout (shell), Sidebar (filterable categories), Header (title, favorite, search, theme, settings)
    tools/[tool]/
      page.jsx              generateStaticParams + per-tool metadata; renders ToolRenderer or AliasRedirect
      ToolRenderer.jsx      Client-only: lazy-loads the tool component, wraps it in an ErrorBoundary, records history
      AliasRedirect.jsx     Client redirect for retired tool URLs (static exports can't send 301s)
  constants/
    tools.js                CATEGORIES, TOOLS, TOOL_ALIASES and search helpers — the single source of truth
    site.js                 SITE_URL used for canonical URLs, robots.txt and sitemap.xml
  features/
    code-tools/<tool>/      Formatters, converters, generators (+ shared/CodeToolPage.jsx)
    image-tools/            ImageStudio.jsx
    security-tools/<tool>/  Security tools
    network-tools/<tool>/   DNS, WHOIS, SEO, subnet
  shared/
    components/             Reusable UI (see below)
    hooks/                  useDebounce, useMounted, useResolvedScheme, useCopyToClipboard…
    lib/                    Pure helpers (see below)
    stores/                 Zustand stores persisted to localStorage
    workers/                diff.worker.js, image.worker.js
  styles/global.css         Tailwind import, design tokens (CSS variables) for light/dark, shared classes
proxy/                      Cloudflare Worker (separate npm project, deployed with Wrangler)
public/.htaccess            Apache config; copied into out/ by the static export
.github/workflows/deploy.yml  Builds out/ and publishes it to the `deploy` branch
```

## Tool registry and routing

`src/constants/tools.js` lists every tool once:

```js
{ id: 'hash-generator', label: 'Hash Generator', category: 'security', icon: IconHash, isNew: false,
  desc: 'MD5, SHA-1, SHA-2 hashes and HMAC…', keywords: ['hash', 'md5', 'sha256', …] }
```

Everything else reads from it: the sidebar, the ⌘K search (`searchTools`), the home page, `generateStaticParams`, per-tool `<title>`/description/canonical, and `sitemap.xml`.

`/tools/[tool]/page.jsx` is a server component that pre-renders one HTML page per tool (and per alias). It renders `ToolRenderer`, which waits until it is mounted in the browser and then lazy-loads the tool's component from its `LOADERS` map — tools depend on browser-only APIs (canvas, Web Crypto, workers), so they never render on the server. Each tool is a separate chunk; visiting one tool doesn't download the others.

Retired URLs live in `TOOL_ALIASES` (e.g. `css-tools → /tools/js-formatter/?lang=css`); they still get a page that redirects on the client.

## UI layer

- **Mantine 7** for components, **Tailwind CSS 4** for layout utilities, **@tabler/icons-react** for icons.
- Theme: `theme.store` keeps `light | dark | system`; `useResolvedScheme` turns that into `light | dark`; `Providers` passes it to Mantine (`forceColorScheme`) and toggles the `dark` class for Tailwind. An inline script in `layout.jsx` applies the saved theme before first paint.
- Design tokens are CSS variables in `global.css` (`--df-bg-panel`, `--df-border-color`, `--df-checker-a`…) with light and dark values. Mantine `Paper` uses the `df-panel` class.
- Preferences (`prefs.store`): intro animation, background effects, custom cursor — heavy effects are opt-in.
- Layout preference (`view.store`): side-by-side or stacked input/output, used by `CodeToolPage` and others.

### Shared components (`src/shared/components`)

| Component | Use it for |
|---|---|
| `ui.jsx` → `Panel`, `InputArea`, `OutputArea`, `KVTable`, `Finding`, `FindingList`, `Grade`, `Stat`, `PrivacyNote` | Standard sections, monospace input/output with copy & download, label/value tables, severity-coloured findings, letter grades |
| `FixGuides.jsx` | Renders “How to fix — step by step” for findings that carry a `fix` id (guides live in `lib/fixGuides.js`) |
| `CodeEditor.jsx` | Monaco editor with theme sync and fullscreen (Esc to exit) |
| `features/code-tools/shared/CodeToolPage.jsx` | Input → output tools: options bar, Live mode, Sample button, ⌘+Enter, sizes, swap/clear |
| `CopyButton`, `DownloadButton`, `FileDropZone`, `ImagePreview`, `ErrorBoundary`, `GlobalSearch`, `ViewToggle` | Small building blocks |

### Shared libraries (`src/shared/lib`)

| File | Contents |
|---|---|
| `encoding.js` | UTF-8, hex, Base64/Base64URL, Base32, Base58, binary, hexdump, punycode decoding |
| `crypto.js` | Random bytes/ints, MD5, CRC32, digest, HMAC, PBKDF2, entropy, PEM helpers |
| `asn1.js` | DER parser, X.509 certificate and CSR decoder, SPKI key info |
| `ip.js` | IPv4/IPv6 parsing and CIDR matching |
| `rdap.js` | RDAP bootstrap (IANA), lookups with subdomain → registered-domain fallback, summaries, domain findings |
| `ct.js` | Certificate Transparency search (crt.sh with Cert Spotter fallback), hostname aggregation |
| `proxy.js` | Client for the Worker: `inspectUrl`, `legacyWhois`, `ProxyUnavailableError`, `normalizeUrl` |
| `password.js` | Strength estimation and crack-time maths |
| `fixGuides.js` | Remediation guides keyed by id (`hsts`, `csp`, `spf`, `dmarc`, `dkim`, `caa`, `cookies`, `dangling-cname`…) |
| `download.js` | `downloadBlob`, `downloadText`, `formatBytes` |

## Heavy work off the main thread

- `workers/diff.worker.js` computes diff stats and the unified patch.
- The Regex Tester runs each pattern in a throw-away Blob worker with a 1.5 s timeout (ReDoS protection).
- WASM: image codecs (`@jsquash/*`), background removal (`@imgly/background-removal` + ONNX runtime), formatters (`@wasm-fmt/ruff_fmt`, `gofmt`, `clang-format`, `lua_fmt`, `zig_fmt`). All are dynamic imports, loaded only when used.

## Cross-origin isolation

The site sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (from `next.config.mjs` in dev/server mode, from `public/.htaccess` in production). This enables `SharedArrayBuffer` for multi-threaded WASM. Consequences when you write a tool:

- Cross-origin `fetch()` works only with CORS (`mode: 'cors'`, the default) — fine for the public APIs we use.
- Cross-origin images need `crossOrigin="anonymous"` and a server that sends CORS headers, otherwise they are blocked (see the social preview in the SEO tool).
- Same-origin and `blob:` workers are fine.

## Gotchas

- **Tailwind can't override Mantine styles.** Tailwind 4 utilities are in CSS cascade layers while Mantine's CSS is unlayered, so classes like `lg:hidden` on a Mantine component are ignored. Put responsive/visibility classes on a wrapping `<div>`.
- **Node built-ins in browser bundles.** Some formatter plugins reference `fs`/`path`; `next.config.mjs` maps them to `false` for client builds. Packages that need `node:` URIs or native bindings (e.g. the TOML and shell Prettier plugins) can't be bundled and were left out.
- **Client-only rendering.** Tool components use `window`, `localStorage`, `crypto.subtle` freely because `ToolRenderer` mounts them only in the browser. Shared layout components that read persisted Zustand state use `useMounted()` to avoid hydration mismatches.
- **Static export rules.** No API routes, no server redirects, no image optimisation. Anything dynamic belongs in the Worker.

## Adding a new tool

1. **Create the component** — `src/features/<group>/<tool-id>/MyTool.jsx` with a default export. Build it from the shared pieces:

   ```jsx
   import { useState } from 'react';
   import { Stack, SimpleGrid } from '@mantine/core';
   import { InputArea, OutputArea } from '@/shared/components/ui';

   export default function MyTool() {
     const [input, setInput] = useState('');
     return (
       <Stack gap="md">
         <SimpleGrid cols={{ base: 1, lg: 2 }}>
           <InputArea value={input} onChange={setInput} />
           <OutputArea value={input.toUpperCase()} />
         </SimpleGrid>
       </Stack>
     );
   }
   ```

   For input → output tools, `CodeToolPage` gives you Monaco editors, Live mode and samples for free. For security checks, return findings as `{ level, title, detail, fix }` and render `<FindingList>` plus `<FixGuides>`.

2. **Register it** in `src/constants/tools.js` (`id`, `label`, `category`, `icon`, `desc`, `keywords`, optional `isNew: true`).
3. **Add a loader** in `src/app/tools/[tool]/ToolRenderer.jsx`:

   ```js
   'my-tool': lazy(() => import('@/features/code-tools/my-tool/MyTool')),
   ```

4. Run `npm run dev` and open `/tools/my-tool`. Sidebar, search, home page and sitemap pick it up automatically.
5. If the tool sends anything over the network, add it to the table in [TOOLS.md](TOOLS.md#what-leaves-your-browser) and say so in the UI.

Renaming or removing a tool? Add the old id to `TOOL_ALIASES` so bookmarks keep working.

## Legacy files (not used by the app)

These are left over from earlier versions and are not imported anywhere; they can be deleted:

- `src/app/routes.jsx` (React Router version) and `test.jsx`
- `src/features/image-tools/image-*/` and `image-tools/shared/` (replaced by Image Studio)
- `src/features/code-tools/json-{fixer,linter,minify,beautify}/` (replaced by JSON Studio)
- `src/shared/components/ToolHeader.jsx`, `SimpleEditor.jsx`, `hooks/useWorker.js`, `hooks/useFileReader.js`, `hooks/useFileDownload.js`
