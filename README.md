# DevForge — Developer & Security Tools

**40 developer and cybersecurity tools that run in your browser.**
Format code, decode tokens, hash files, generate keys, inspect certificates, audit security headers, check SEO and more — your data stays in the tab.

Live: **https://dev-tools.serversbay.com**

---

## Highlights

- **Privacy first** — almost every tool works offline with Web Crypto, WebAssembly and Web Workers. The few that must touch the network say so in the UI (see [Tools & privacy](docs/TOOLS.md#what-leaves-your-browser)).
- **40 tools in 6 categories** — studios, code & formatters, encoders & converters, generators, security, network & web.
- **Security tools with fixes** — every finding links to a step-by-step *How to fix* guide with ready-to-copy config for Nginx, Apache, Cloudflare, Node.js, Laravel/PHP and Next.js.
- **Fast UI** — ⌘K / `/` search, favorites, recently used, dark/light/system theme, side-by-side or stacked layouts, every tool code-split.
- **Static hosting** — exports to plain HTML/JS (`out/`) for Apache or any static host. An optional Cloudflare Worker adds the features browsers can't do alone (reading another site's headers/HTML, legacy WHOIS).

## Tools

| Category | Tools |
|---|---|
| **Studios** | Image Studio · JSON Studio |
| **Code & Formatters** | Code Formatter & Minifier (26 languages) · JS Linter · HTML Tools · SQL Formatter · XML Tools · YAML Tools · Markdown Editor · Diff Viewer · Regex Tester |
| **Encoders & Converters** | Base64 · URL Encoder · String Escaper · Number Base Converter · Timestamp Converter · Color Converter · Cron Parser |
| **Generators & Text** | UUID / ID Generator · QR Code Generator · Text Utilities · Lorem Ipsum |
| **Security** | Password Generator · Hash Generator · Bcrypt & PBKDF2 · JWT Debugger · Encrypt / Decrypt (AES-GCM) · Key Pair Generator · Certificate Decoder · Cipher Lab · TOTP / 2FA · File Inspector · EXIF / Metadata · URL Analyzer · Subdomain Finder · Security Headers |
| **Network & Web** | DNS & Email Security · SEO & Performance · WHOIS / RDAP Lookup · Subnet Calculator |

Full descriptions, URLs and network behaviour per tool: **[docs/TOOLS.md](docs/TOOLS.md)**.

## Quick start

Requirements: **Node.js 18.17+** (developed and built on Node 22) and npm.

```bash
npm install
npm run dev            # http://localhost:3000
```

To use the URL-based features locally (Security Headers → *Check a URL*, SEO & Performance, legacy WHOIS), run the proxy Worker as well:

```bash
cd proxy && npm install && npm run dev     # Worker on http://localhost:8787
```

and create `.env.development.local` in the project root:

```bash
NEXT_PUBLIC_PROXY_URL=http://localhost:8787/api
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Regular Next.js server build (`npm start` to serve) |
| `npm run build:static` | **Static export** to `out/` — what production uses |
| `npm start` | Serve the server build |
| `npm run lint` | ESLint |
| `cd proxy && npm run dev` | Run the Cloudflare Worker locally |
| `cd proxy && npm run deploy` | Deploy the Worker (`wrangler deploy`) |

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_PROXY_URL` | `/api` | Base URL of the proxy Worker. Production uses the same-origin route `dev-tools.serversbay.com/api/*`. |
| `STATIC_EXPORT` | unset | Set to `1` (done by `build:static`) for `output: 'export'` + trailing slashes. |

## Deployment

Production is a static site behind Cloudflare, plus the optional Worker:

1. **GitHub Actions** ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) builds `out/` on every push to `main` and publishes it to the `deploy` branch.
2. **Enhance panel** → GitHub deploy tracks the `deploy` branch (no build script, no publish directory, runtime **None**).
3. **Cloudflare Worker** for `/api/*` is deployed separately with Wrangler.

Step-by-step guide, manual Apache upload, Cloudflare settings, verification and rollback: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.
Worker details: **[proxy/README.md](proxy/README.md)**.

## Project structure

```
src/
  app/                  Next.js app router: layout, home dashboard, /tools/[tool] route, robots & sitemap
    layout/             Sidebar, Header, MainLayout
    tools/[tool]/       Static params, metadata, ToolRenderer (lazy loads tools), alias redirects
  constants/tools.js    Single registry of every tool (sidebar, search, home, sitemap read it)
  features/             One folder per tool: code-tools, image-tools, security-tools, network-tools
  shared/
    components/         UI building blocks (Panel, InputArea, FindingList, FixGuides, CodeEditor…)
    lib/                Encoding, crypto, ASN.1, IP, RDAP, CT logs, proxy client, fix guides…
    stores/             Zustand stores (theme, favorites, history, layout, preferences)
    workers/            Web Workers (diff, image)
proxy/                  Cloudflare Worker (headers/HTML inspection, port-43 WHOIS)
public/.htaccess        Apache config shipped inside out/
.github/workflows/      Static build → deploy branch
```

How it all fits together and how to add a new tool: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Tech stack

Next.js 14 (app router, static export) · React 18 · Mantine 7 · Tailwind CSS 4 · Zustand · Monaco Editor · Prettier + WASM formatters (Ruff, gofmt, clang-format…) · jose · Web Crypto · Cloudflare Workers.

## Documentation

| Doc | Contents |
|---|---|
| [docs/TOOLS.md](docs/TOOLS.md) | Every tool, its URL, features and what (if anything) leaves the browser |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Code layout, registry & routing, shared libraries, gotchas, adding a tool |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Enhance + GitHub Actions, Apache, Cloudflare, Worker, troubleshooting |
| [proxy/README.md](proxy/README.md) | The proxy Worker's endpoints, safety limits and deploy commands |
