# DevForge proxy (Cloudflare Worker)

Does only what a browser can't, for these tools:

| Endpoint | Used by |
|---|---|
| `GET /api/inspect?url=…` | Security Headers → “Check a URL” (status, redirects, headers; cookie values masked) |
| `GET /api/inspect?url=…&body=1` | SEO & Performance (HTML / robots.txt / sitemap, max 2 MB, text types only) |
| `GET /api/whois?q=domain` | WHOIS / RDAP → legacy port-43 WHOIS for TLDs without RDAP (.io, .de …) |
| `GET /api/health` | health check |

Safety: only `http(s)` on ports 80/443, no IP literals / localhost / private ranges (also checked after DNS),
max 5 redirects, 10 s timeout, other websites' browsers are rejected by Origin, 30 requests/minute per IP.

## Deploy (once)

```bash
cd proxy
npm install
npx wrangler login        # opens Cloudflare in the browser
npx wrangler deploy       # creates the Worker and the route dev-tools.serversbay.com/api/*
```

The route in `wrangler.toml` puts the Worker on the same domain as the site, so no CORS setup is needed.
`dev-tools.serversbay.com` must be proxied through Cloudflare (orange cloud), which it already is.

## Local development

```bash
cd proxy && npm run dev                 # Worker on http://localhost:8787
# in the project root, .env.development.local contains:
# NEXT_PUBLIC_PROXY_URL=http://localhost:8787/api
```

Logs: `npx wrangler tail`.
