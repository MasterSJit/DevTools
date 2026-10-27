# Tools & privacy

All 40 tools live at `/tools/<id>/`. Unless a tool is listed under [What leaves your browser](#what-leaves-your-browser), it works entirely offline once the page has loaded.

## Studios

| Tool | URL | Features |
|---|---|---|
| Image Studio | `/tools/image-studio/` | Pipeline editor with undo/redo: compress (MozJPEG, OxiPNG, WebP, AVIF via WASM codecs), resize, crop, rotate/flip, filters, convert, text watermark, AI background removal. Paste an image with ⌘/Ctrl+V. |
| JSON Studio | `/tools/json-studio/` | Beautify, minify, fix/repair (comments, trailing commas, single quotes, unquoted keys, Python literals, missing commas, JSONP wrappers), validate with JSON Schema (Ajv), sort keys, JSONPath query, convert to CSV / YAML / TypeScript / escaped string, CSV → JSON. |

## Code & Formatters

| Tool | URL | Features |
|---|---|---|
| Code Formatter & Minifier | `/tools/js-formatter/` | Formats 26 languages: JS/JSX, TS/TSX, JSON, HTML, CSS, SCSS, Less, Vue, Angular, GraphQL, Markdown, YAML, XML, SVG, SQL, PHP, Python (Ruff), Go (gofmt), Java, C, C++, C#, Objective-C, Protobuf (clang-format), Lua, Zig. Minifies JS (Terser), JSON, HTML, CSS/SCSS/Less, GraphQL, XML, SVG (SVGO), SQL. Deep link: `?lang=css&mode=minify`. Replaces the old CSS Tools (`/tools/css-tools/` redirects here). |
| JS Linter | `/tools/js-linter/` | Acorn parser (ES2024, modules or scripts): syntax errors with line/column, `var`, `==`, `debugger`, empty catch, `eval`/`new Function`/string timers, `innerHTML`/`document.write` XSS sinks, secrets in Web Storage, hard-coded keys and tokens. |
| HTML Tools | `/tools/html-tools/` | Format, minify (keeps `<pre>`, `<textarea>`, `<script>`, `<style>` intact), live preview in a sandboxed iframe with device widths and optional scripts. |
| SQL Formatter | `/tools/sql-formatter/` | 14 dialects, keyword case, indent, minify. |
| XML Tools | `/tools/xml-tools/` | Format, minify, validate with line/column, XML ⇄ JSON. |
| YAML Tools | `/tools/yaml-tools/` | Multi-document format/validate, YAML ⇄ JSON, sort keys. |
| Markdown Editor | `/tools/markdown-editor/` | GFM with toolbar and shortcuts, edit/split/preview, auto-saved draft, export `.md` or standalone `.html`. Raw HTML is not rendered (XSS-safe). |
| Diff Viewer | `/tools/diff-viewer/` | Monaco diff editor (side-by-side or inline), ignore whitespace/case, stats in a Web Worker, unified `.patch` export. |
| Regex Tester | `/tools/regex-tester/` | Live highlighting, groups and named groups, replace preview, presets. Runs in a Web Worker with a 1.5 s timeout to catch catastrophic backtracking (ReDoS). |

## Encoders & Converters

| Tool | URL | Features |
|---|---|---|
| Base64 | `/tools/base64-tool/` | UTF-8-safe text encode/decode, Base64URL, MIME wrapping, file → data URI, data URI/Base64 → file with type detection. |
| URL Encoder | `/tools/url-encoder/` | Component / full URL / form / encode-all, URL parser with editable query parameters. |
| String Escaper | `/tools/string-escaper/` | HTML (OWASP), HTML numeric, JavaScript, JSON, URL, SQL literal, POSIX shell, regex, CSV, XML, Unicode `\uXXXX`, code points. |
| Number Base Converter | `/tools/number-base/` | BigInt-safe bases 2–36, two's complement for 8–128 bits. |
| Timestamp Converter | `/tools/timestamp-converter/` | Auto-detects s/ms/µs/ns, every IANA time zone, ISO 8601, RFC 2822, SQL, Windows FILETIME, relative time. |
| Color Converter | `/tools/color-converter/` | HEX/RGB/HSL/HSV/CMYK/OKLCH/LAB, palettes, tints & shades, WCAG contrast checker. |
| Cron Parser | `/tools/cron-parser/` | Plain-English description, 5 or 6 fields, macros (`@daily`), next runs in any time zone. |

## Generators & Text

| Tool | URL | Features |
|---|---|---|
| UUID / ID Generator | `/tools/uuid-generator/` | UUID v1/v4/v7, ULID, NanoID, nil/max; inspect version, variant and embedded timestamps. |
| QR Code Generator | `/tools/qr-generator/` | Text/URL, Wi-Fi, e-mail, SMS, phone, vCard; colors, error correction, PNG/SVG. Scan QR from an image (BarcodeDetector, Chromium browsers). |
| Text Utilities | `/tools/text-tools/` | 12 case styles incl. slugify, line sort/dedupe/shuffle/number, clean-up, stats and word frequency. |
| Lorem Ipsum | `/tools/lorem-generator/` | Paragraphs, sentences, words or list items as plain text, HTML or Markdown; large output and fullscreen view. |

## Security

| Tool | URL | Features |
|---|---|---|
| Password Generator | `/tools/password-tools/` | Passwords, passphrases, PINs with `crypto.getRandomValues` and rejection sampling; strength checker with entropy, pattern detection, crack-time estimates and an optional Have I Been Pwned check. |
| Hash Generator | `/tools/hash-generator/` | MD5, SHA-1/256/384/512, CRC32, HMAC for text or files (hex/HEX/Base64), checksum verification. |
| Bcrypt & PBKDF2 | `/tools/bcrypt-tool/` | bcrypt hash/verify with cost factor and timing; PBKDF2 key derivation. |
| JWT Debugger | `/tools/jwt-decoder/` | Decode, verify (HS/RS/PS/ES/EdDSA with secret, PEM, X.509 or JWK), sign, claim timeline and a security review (alg none, jku/x5u/jwk headers, expiry, sensitive claims). |
| Encrypt / Decrypt | `/tools/aes-crypto/` | AES-256-GCM with PBKDF2-SHA256 (600k iterations) for text and files; raw-key mode for AES-GCM/CBC/CTR. |
| Key Pair Generator | `/tools/keypair-generator/` | RSA 2048–4096, ECDSA P-256/384/521, Ed25519 → PEM, JWK, JWKS and OpenSSH `authorized_keys` with SHA-256 fingerprint. |
| Certificate Decoder | `/tools/cert-decoder/` | Decode PEM/DER certificates, chains and CSRs (SANs, extensions, key, fingerprints, validity) with a security review. **Look up by domain** finds every certificate issued for a hostname in CT logs and decodes it. |
| Cipher Lab | `/tools/cipher-lab/` | Recipe chain of encodings and classic ciphers (Base32/58/64, hex, binary, URL, HTML, ROT13/47, Caesar, Atbash, Vigenère, XOR, Morse, A1Z26…); Caesar and single-byte XOR brute force ranked by English likeness. |
| TOTP / 2FA | `/tools/totp-generator/` | Live codes (SHA1/256/512, 6–8 digits, custom period), new secrets, `otpauth://` URI and QR. |
| File Inspector | `/tools/file-inspector/` | Real type from magic bytes, extension-mismatch and double-extension warnings, PE/ELF headers, entropy chart, hex dump, strings, IOC extraction, MD5/SHA-1/SHA-256. |
| EXIF / Metadata | `/tools/metadata-privacy/` | EXIF/GPS/IPTC/XMP viewer with privacy review; lossless metadata removal for JPEG and PNG. |
| URL Analyzer | `/tools/url-analyzer/` | Static phishing checks: punycode homographs, look-alike characters, encoded IP hosts, `@` tricks, risky TLDs, brand impersonation, open-redirect parameters; defang/refang. The URL is never opened. |
| Subdomain Finder | `/tools/subdomain-finder/` | Hostnames from Certificate Transparency logs plus MX/NS/SRV records and common names (wildcard-DNS aware), DNS check, dangling-CNAME (takeover) detection, CSV export. |
| Security Headers | `/tools/security-headers/` | Check a URL (direct browser request, then proxy) or paste raw headers: HSTS, CSP, framing, nosniff, Referrer/Permissions-Policy, COOP, CORS, cookies, version disclosure, HTTP→HTTPS redirect; grade A+–F; CSP evaluator. |

## Network & Web

| Tool | URL | Features |
|---|---|---|
| DNS & Email Security | `/tools/dns-lookup/` | DNS records via DNS-over-HTTPS (Cloudflare or Google), PTR for IPv4; e-mail audit: SPF, DMARC, DKIM (selectors auto-detected from your mail providers, key size), MX, MTA-STS, TLS-RPT, CAA, BIMI. |
| SEO & Performance | `/tools/seo-analyzer/` | Fetches a page with robots.txt and sitemap and scores SEO, performance, best practices and social; Google and social previews, heading outline; optional Lighthouse via PageSpeed Insights. Also works on pasted HTML. |
| WHOIS / RDAP Lookup | `/tools/whois-lookup/` | Domains (subdomains resolve to the registered domain), IPv4/IPv6 networks and ASNs via RDAP, domain-health review; legacy port-43 WHOIS fallback for TLDs without RDAP. |
| Subnet Calculator | `/tools/subnet-calculator/` | IPv4 CIDR/netmask maths, classification, subnet splitting, membership check; IPv6 expand/compress and prefix ranges. |

All security findings (Security Headers, DNS & Email Security, WHOIS, Certificate Decoder, Subdomain Finder) include a **How to fix — step by step** panel with configuration for Nginx, Apache, Cloudflare, Node.js, Laravel/PHP, Next.js and DNS.

## What leaves your browser

Everything not listed here is processed locally. Where the network is used, only the item listed is sent.

| Tool / feature | Sent to | What is sent |
|---|---|---|
| DNS & Email Security, Subdomain Finder (DNS check) | Cloudflare `1.1.1.1` or Google DNS over HTTPS | The domain / hostnames being looked up |
| WHOIS / RDAP Lookup | IANA bootstrap files, then the registry's RDAP server (Verisign, ARIN, RIPE…) | The domain, IP or ASN |
| Subdomain Finder, Certificate Decoder → Look up by domain | crt.sh, api.certspotter.com | The domain |
| Password checker → breach check (opt-in button) | api.pwnedpasswords.com | First 5 hex characters of the password's SHA-1 (k-anonymity) |
| Security Headers → Check a URL | The target site (direct attempt), then the DevForge proxy | The URL |
| SEO & Performance (URL mode) | DevForge proxy | The page, robots.txt and sitemap URLs |
| SEO & Performance → Lighthouse (opt-in) | Google PageSpeed Insights API | The URL and, if entered, your API key |
| WHOIS legacy fallback (button) | DevForge proxy → registry port-43 WHOIS | The domain |
| Image Studio → BG Remove | `staticimgly.com` | Nothing about the image — only the AI model is downloaded |
| Code editors | `cdn.jsdelivr.net` | Nothing — the Monaco editor is loaded from the CDN |
| Links you click (VirusTotal hash lookup, OpenStreetMap) | Those sites | Only when you click the link |

The **DevForge proxy** is our Cloudflare Worker ([proxy/](../proxy/README.md)): it returns status, redirects and headers (cookie values masked) or text bodies up to 2 MB, refuses private/internal addresses, and stores nothing.

## Not possible in a browser

These need raw sockets or server infrastructure and are intentionally not included:

- Port scanning, ping, traceroute (no raw sockets or ICMP in browsers or Workers)
- Live TLS handshake details (protocol versions, ciphers, the exact chain a server presents) — needs a small server-side TLS client
- SMTP / mail-server testing (port 25 is blocked in Workers)
- City-level IP geolocation (needs a GeoIP database or paid API)
- Uptime monitoring and screenshots (possible later with Worker Cron Triggers / Browser Rendering)
- VirusTotal file upload and e-mail breach lookups (need API keys)
