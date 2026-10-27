# Deployment

Production = **static files** (`out/`) on the Enhance-managed server behind Cloudflare, plus an optional **Cloudflare Worker** on `/api/*`.

| Part | Built by | Served by | Needed for |
|---|---|---|---|
| Website (`out/`) | GitHub Actions (`npm run build:static`) | Enhance / Apache | Everything |
| Proxy Worker (`proxy/`) | `wrangler deploy` | Cloudflare | Security Headers → Check a URL, SEO & Performance (URL mode), legacy WHOIS |

The site works without the Worker — those three features then show “proxy not reachable” and offer their paste/offline modes.

---

## Option A — Enhance GitHub deploy (recommended)

Building a Next.js app on the hosting server would create ~1.1 GB of `node_modules` and ~1.3 GB of build cache **per deploy** (Enhance keeps every deploy in its own folder) and can hit memory limits. Instead, GitHub builds the site and Enhance only pulls the finished ~50 MB.

### 1. Let GitHub build the site

The workflow [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) runs on every push to `main`:

1. installs dependencies with Node 22 (`npm ci`),
2. runs `npm run build:static`,
3. force-pushes the contents of `out/` (including `.htaccess`) to the **`deploy`** branch.

After pushing the workflow, open **GitHub → Actions** and wait for the green check. If it fails with a permission error: **Settings → Actions → General → Workflow permissions → Read and write permissions**, save, then re-run the workflow.

### 2. Configure Enhance

**Website → Git deploy → Configure GitHub deploy:**

| Field | Value |
|---|---|
| Repository | `DevTools` |
| Branch or tag | **`deploy`** |
| Auto deploy on push | **On** |
| Build script | *(empty)* |
| Publish directory | *(empty — the site is at the branch root)* |
| Persistent runtime | **None** |

Do **not** pick the Node.js runtime with `npm start`: `next start` doesn't work with a static export and would crash-loop.

Enhance clones the branch into `deploys/<uuid>/`, points `deploys/current` at it and serves it as the document root. From now on: push to `main` → Action builds → `deploy` branch updates → Enhance deploys automatically.

### 3. Purge Cloudflare and verify

See [Cloudflare settings](#cloudflare-settings) and [Verification](#verification).

<details>
<summary>Alternative: build on the Enhance server</summary>

Only if the server has Node.js available to build scripts and enough disk/RAM:

| Field | Value |
|---|---|
| Branch | `main` |
| Build script | `npm ci --include=dev && npm run build:static` |
| Publish directory | `out` |
| Persistent runtime | None |

If the deploy log shows `npm: command not found`, use Option A.
</details>

---

## Option B — Manual upload to Apache

```bash
npm run build:static
```

```bash
rsync -avz --delete out/ USER@SERVER:/path/to/document-root/
```

- The trailing slash on `out/` matters (copies the contents, not the folder).
- `--delete` removes old files in the document root — back it up first and don't use it if other things live there.
- Uploading through a file manager instead? Zip the *contents* of `out/` and enable “show hidden files” so `.htaccess` is included.

### Apache requirements

`public/.htaccess` (shipped as `out/.htaccess`) needs:

- `AllowOverride All` for the document root
- modules `rewrite`, `headers`, `expires`, `deflate`, `mime` (Debian/Ubuntu: `sudo a2enmod rewrite headers expires deflate mime`)

It sets `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy`, long-lived caching for hashed assets, `/404.html`, and redirects `/tools/foo` → `/tools/foo/`.

On **OpenLiteSpeed or Nginx** backends, `Header` lines in `.htaccess` may be ignored — set those headers in the panel or with a Cloudflare Transform Rule instead.

---

## Cloudflare settings

For the `serversbay.com` zone, after each first deploy or big change:

1. **Caching → Configuration → Purge Everything.**
2. **Speed → Optimization → Rocket Loader → Off** (it breaks Next.js scripts).
3. **Rules → Transform Rules → Managed Transforms → “Add security headers” → Off**, otherwise headers like `X-Frame-Options` appear twice.
4. Optional, once everything is HTTPS: **SSL/TLS → Edge Certificates → HSTS** (12 months, include subdomains).

---

## Proxy Worker

```bash
cd proxy
npm install
npx wrangler login      # log in to the Cloudflare account that owns serversbay.com
npx wrangler deploy     # deploys devforge-proxy with the route dev-tools.serversbay.com/api/*
```

If the deploy fails because of the `ratelimits` binding, remove the `[[ratelimits]]` block from `proxy/wrangler.toml` and deploy again — the Worker works without it (just without the per-IP limit).

Endpoints, safety limits and local development: [proxy/README.md](../proxy/README.md). Live logs: `npx wrangler tail`.

---

## Verification

```bash
curl -sI https://dev-tools.serversbay.com/tools/hash-generator/ | grep -iE "^HTTP|cross-origin-opener|x-frame|x-content-type"
```

Expect `HTTP/2 200` and the security headers listed above.

```bash
curl -s https://dev-tools.serversbay.com/robots.txt
```

```bash
curl -s https://dev-tools.serversbay.com/api/health
```

Expect `{"ok":true}` once the Worker is deployed. Then in the browser:

- the home page shows the tool count and categories;
- `/tools/css-tools/` forwards to the Code Formatter;
- Security Headers → *Check a URL* shows “Fetched via DevForge proxy”;
- SEO & Performance analyzes `https://dev-tools.serversbay.com`.

---

## Rollback

- **Website (Enhance):** revert the bad commit on `main` and push — the Action rebuilds and Enhance deploys the previous state. (Enhance keeps earlier deploys under `deploys/`; a failed build never replaces the live one.)
- **Website (manual):** restore the document-root backup.
- **Worker:** `cd proxy && npx wrangler rollback` (previous version) or `npx wrangler delete` (remove it; URL features fall back to paste mode).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `sh: …/node_modules/.bin/next: Permission denied` | `node_modules` was copied from another machine. Run `find node_modules/.bin -type f -exec chmod +x {} +`, or delete `node_modules` and run `npm install`. |
| Build error `Can't resolve 'fs'` / `node:crypto` | A newly added dependency needs Node built-ins. Map it in `next.config.mjs` (`resolve.fallback`) or use a browser build of the package. |
| Site loads but security headers are missing | `.htaccess` not uploaded (hidden file), `AllowOverride` not enabled, `mod_headers` missing, or a LiteSpeed/Nginx backend — see [Apache requirements](#apache-requirements). |
| Old version still shows after deploy | Purge the Cloudflare cache. |
| “The DevForge proxy … is not reachable” | Worker not deployed, route missing, or the `dev-tools` DNS record is not proxied (grey cloud). Check `/api/health`. |
| GitHub Action fails at “Publish out/ to the deploy branch” | Give workflows *Read and write* permission (see Option A, step 1). |
