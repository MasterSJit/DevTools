import {
  IconPhoto, IconBraces, IconBrackets, IconTerminal2, IconDatabase, IconBrandHtml5,
  IconBrandJavascript, IconShieldCheck, IconKey, IconLock, IconLink,
  IconHash, IconId, IconLetterCase, IconGitCompare, IconPalette, IconClock, IconMarkdown,
  IconRegex, IconCalendarTime, IconQrcode, IconPassword, IconCertificate,
  IconShieldLock, IconDeviceMobileCode, IconFileSearch, IconPhotoShield, IconWorldSearch,
  IconNetwork, IconLetterA, IconBinary, IconCode, IconSparkles, IconTransform, IconSquareKey,
  IconLockSquareRounded, IconSpy, IconShieldHalf, IconAt, IconBug, IconWorldWww, IconSitemap, IconSeo,
} from '@tabler/icons-react';

/**
 * Single source of truth for every tool in the app.
 * Sidebar, header, search, home page and the /tools/[tool] route all read from here.
 */

export const CATEGORIES = [
  { id: 'studios', label: 'Studios', desc: 'All-in-one pipelines for images and JSON.', icon: IconSparkles, color: 'violet' },
  { id: 'code', label: 'Code & Formatters', desc: 'Format, lint, diff and preview source code.', icon: IconCode, color: 'indigo' },
  { id: 'convert', label: 'Encoders & Converters', desc: 'Base64, URLs, escaping, timestamps, colors and more.', icon: IconTransform, color: 'cyan' },
  { id: 'generate', label: 'Generators & Text', desc: 'IDs, QR codes, placeholder text and text utilities.', icon: IconLetterA, color: 'teal' },
  { id: 'security', label: 'Security', desc: 'Crypto, hashing, JWTs, certificates and analysis — offline.', icon: IconShieldLock, color: 'red' },
  { id: 'network', label: 'Network & Web', desc: 'DNS, subnets and web security checks.', icon: IconNetwork, color: 'orange' },
];

export const TOOLS = [
  // ── Studios ──
  { id: 'image-studio', label: 'Image Studio', category: 'studios', icon: IconPhoto,
    desc: 'Compress, resize, crop, rotate, filter, convert, watermark and remove backgrounds.',
    keywords: ['image', 'compress', 'resize', 'crop', 'rotate', 'webp', 'avif', 'png', 'jpg', 'watermark', 'background', 'convert'] },
  { id: 'json-studio', label: 'JSON Studio', category: 'studios', icon: IconBraces,
    desc: 'Beautify, minify, fix, validate (JSON Schema), query and convert JSON to CSV / YAML / TypeScript.',
    keywords: ['json', 'beautify', 'minify', 'fix', 'repair', 'schema', 'validate', 'csv', 'typescript', 'query', 'path'] },

  // ── Code & Formatters ──
  { id: 'js-formatter', label: 'Code Formatter & Minifier', category: 'code', icon: IconBrandJavascript,
    desc: 'Format 26 languages (JS, TS, HTML, CSS, PHP, Python, Go, Java, C/C++, C#, SQL, YAML…) and minify JS, CSS, HTML, JSON, SVG, XML.',
    keywords: ['format', 'beautify', 'minify', 'prettier', 'javascript', 'typescript', 'css', 'scss', 'html', 'php', 'python', 'go', 'java', 'c', 'cpp', 'csharp', 'sql', 'json', 'yaml', 'xml', 'svg', 'graphql', 'lua', 'uglify', 'compress'] },
  { id: 'js-linter', label: 'JS Linter', category: 'code', icon: IconBug,
    desc: 'Real parser-based syntax check plus common code-smell and security warnings.',
    keywords: ['javascript', 'lint', 'eslint', 'syntax', 'check', 'eval'] },
  { id: 'html-tools', label: 'HTML Tools', category: 'code', icon: IconBrandHtml5,
    desc: 'Format, minify and live-preview HTML in a sandbox.',
    keywords: ['html', 'format', 'minify', 'preview'] },
  { id: 'sql-formatter', label: 'SQL Formatter', category: 'code', icon: IconDatabase,
    desc: 'Format SQL for MySQL, PostgreSQL, SQLite, T-SQL, BigQuery and more.',
    keywords: ['sql', 'format', 'query', 'mysql', 'postgres'] },
  { id: 'xml-tools', label: 'XML Tools', category: 'code', icon: IconBrackets,
    desc: 'Format, validate and convert between XML and JSON.',
    keywords: ['xml', 'format', 'validate', 'convert', 'json'] },
  { id: 'yaml-tools', label: 'YAML Tools', category: 'code', icon: IconTerminal2,
    desc: 'Format, validate and convert between YAML and JSON.',
    keywords: ['yaml', 'yml', 'format', 'convert', 'json', 'kubernetes'] },
  { id: 'markdown-editor', label: 'Markdown Editor', category: 'code', icon: IconMarkdown,
    desc: 'GitHub-flavoured markdown with live preview and HTML export.',
    keywords: ['markdown', 'md', 'editor', 'preview', 'readme'] },
  { id: 'diff-viewer', label: 'Diff Viewer', category: 'code', icon: IconGitCompare,
    desc: 'Compare two texts with word-level highlighting and export a .patch.',
    keywords: ['diff', 'compare', 'merge', 'patch', 'changes'] },
  { id: 'regex-tester', label: 'Regex Tester', category: 'code', icon: IconRegex, isNew: true,
    desc: 'Test regular expressions live with match highlighting, groups and replace.',
    keywords: ['regex', 'regexp', 'regular expression', 'match', 'replace', 'pattern'] },

  // ── Encoders & Converters ──
  { id: 'base64-tool', label: 'Base64', category: 'convert', icon: IconLock,
    desc: 'Encode / decode Base64 and Base64URL text, and convert files to data URIs and back.',
    keywords: ['base64', 'encode', 'decode', 'data uri', 'base64url'] },
  { id: 'url-encoder', label: 'URL Encoder', category: 'convert', icon: IconLink,
    desc: 'Encode / decode URL components and break URLs into parts and query params.',
    keywords: ['url', 'encode', 'decode', 'percent', 'query', 'params'] },
  { id: 'string-escaper', label: 'String Escaper', category: 'convert', icon: IconCode, isNew: true,
    desc: 'Escape / unescape for HTML, JavaScript, JSON, SQL, shell, regex and Unicode.',
    keywords: ['escape', 'unescape', 'html entities', 'sanitize', 'unicode', 'sql', 'shell'] },
  { id: 'number-base', label: 'Number Base Converter', category: 'convert', icon: IconBinary, isNew: true,
    desc: 'Convert between binary, octal, decimal, hex and any base (BigInt-safe).',
    keywords: ['binary', 'hex', 'octal', 'decimal', 'base', 'radix', 'number'] },
  { id: 'timestamp-converter', label: 'Timestamp Converter', category: 'convert', icon: IconCalendarTime, isNew: true,
    desc: 'Unix epoch ⇄ human dates in any timezone, ISO 8601 and relative time.',
    keywords: ['timestamp', 'epoch', 'unix', 'date', 'time', 'iso', 'timezone'] },
  { id: 'color-converter', label: 'Color Converter', category: 'convert', icon: IconPalette,
    desc: 'HEX / RGB / HSL / HSV / CMYK conversion, palettes and WCAG contrast checker.',
    keywords: ['color', 'hex', 'rgb', 'hsl', 'contrast', 'wcag', 'palette'] },
  { id: 'cron-parser', label: 'Cron Parser', category: 'convert', icon: IconClock,
    desc: 'Explain cron expressions in plain English and preview upcoming runs.',
    keywords: ['cron', 'schedule', 'crontab', 'expression'] },

  // ── Generators & Text ──
  { id: 'uuid-generator', label: 'UUID / ID Generator', category: 'generate', icon: IconId,
    desc: 'Bulk UUID v1 / v4 / v7, ULID and NanoID generation plus UUID inspection.',
    keywords: ['uuid', 'guid', 'ulid', 'nanoid', 'unique', 'id', 'generate'] },
  { id: 'qr-generator', label: 'QR Code Generator', category: 'generate', icon: IconQrcode, isNew: true,
    desc: 'QR codes for text, URLs, Wi-Fi and contacts — export PNG or SVG.',
    keywords: ['qr', 'qrcode', 'barcode', 'wifi', 'generate'] },
  { id: 'text-tools', label: 'Text Utilities', category: 'generate', icon: IconLetterCase, isNew: true,
    desc: 'Case conversion, slugify, sort / dedupe lines and word / character stats.',
    keywords: ['text', 'case', 'camel', 'snake', 'kebab', 'slug', 'count', 'sort', 'dedupe', 'lines'] },
  { id: 'lorem-generator', label: 'Lorem Ipsum', category: 'generate', icon: IconLetterA,
    desc: 'Placeholder paragraphs, sentences or words.',
    keywords: ['lorem', 'ipsum', 'placeholder', 'text', 'dummy'] },

  // ── Security ──
  { id: 'password-tools', label: 'Password Generator', category: 'security', icon: IconPassword, isNew: true,
    desc: 'Cryptographically secure passwords & passphrases with entropy and strength analysis.',
    keywords: ['password', 'passphrase', 'generate', 'strength', 'entropy', 'random', 'security'] },
  { id: 'hash-generator', label: 'Hash Generator', category: 'security', icon: IconHash,
    desc: 'MD5, SHA-1, SHA-2 hashes and HMAC for text or files, plus checksum compare.',
    keywords: ['hash', 'md5', 'sha', 'sha256', 'sha512', 'hmac', 'checksum', 'integrity'] },
  { id: 'bcrypt-tool', label: 'Bcrypt & PBKDF2', category: 'security', icon: IconSquareKey, isNew: true,
    desc: 'Generate and verify bcrypt hashes and derive PBKDF2 keys.',
    keywords: ['bcrypt', 'pbkdf2', 'password hash', 'verify', 'kdf', 'salt'] },
  { id: 'jwt-decoder', label: 'JWT Debugger', category: 'security', icon: IconKey,
    desc: 'Decode, verify and sign JSON Web Tokens with security warnings.',
    keywords: ['jwt', 'token', 'decode', 'verify', 'sign', 'json web token', 'hs256', 'rs256'] },
  { id: 'aes-crypto', label: 'Encrypt / Decrypt', category: 'security', icon: IconLockSquareRounded, isNew: true,
    desc: 'AES-256-GCM text and file encryption with a password (PBKDF2), all in-browser.',
    keywords: ['aes', 'encrypt', 'decrypt', 'cipher', 'gcm', 'password', 'file'] },
  { id: 'keypair-generator', label: 'Key Pair Generator', category: 'security', icon: IconShieldCheck, isNew: true,
    desc: 'Generate RSA / ECDSA / Ed25519 key pairs as PEM and JWK.',
    keywords: ['rsa', 'ecdsa', 'ed25519', 'key', 'pem', 'jwk', 'public key', 'private key'] },
  { id: 'cert-decoder', label: 'Certificate Decoder', category: 'security', icon: IconCertificate, isNew: true,
    desc: 'Decode X.509 PEM certificates: subject, issuer, SANs, validity and fingerprints.',
    keywords: ['certificate', 'x509', 'ssl', 'tls', 'pem', 'crt', 'san', 'fingerprint'] },
  { id: 'cipher-lab', label: 'Cipher Lab', category: 'security', icon: IconSpy, isNew: true,
    desc: 'Chain encodings & classic ciphers — hex, base32/58, ROT, Caesar brute force, XOR, Vigenère, Morse.',
    keywords: ['cipher', 'caesar', 'rot13', 'xor', 'vigenere', 'morse', 'hex', 'base32', 'base58', 'ctf', 'cyberchef'] },
  { id: 'totp-generator', label: 'TOTP / 2FA', category: 'security', icon: IconDeviceMobileCode, isNew: true,
    desc: 'Generate live TOTP codes from a secret, create new 2FA secrets and otpauth QR codes.',
    keywords: ['totp', '2fa', 'mfa', 'otp', 'authenticator', 'google authenticator'] },
  { id: 'file-inspector', label: 'File Inspector', category: 'security', icon: IconFileSearch, isNew: true,
    desc: 'Detect real file type by magic bytes, hex dump, entropy, embedded strings and hashes.',
    keywords: ['file', 'magic bytes', 'hex', 'hexdump', 'entropy', 'strings', 'forensics', 'malware'] },
  { id: 'metadata-privacy', label: 'EXIF / Metadata', category: 'security', icon: IconPhotoShield, isNew: true,
    desc: 'View image metadata (GPS, camera, software), flag privacy leaks and strip it.',
    keywords: ['exif', 'metadata', 'gps', 'privacy', 'strip', 'image'] },
  { id: 'url-analyzer', label: 'URL Analyzer', category: 'security', icon: IconWorldSearch, isNew: true,
    desc: 'Break down a URL and flag phishing indicators — homographs, IP hosts, obfuscation.',
    keywords: ['url', 'phishing', 'homograph', 'punycode', 'analyze', 'suspicious', 'link'] },
  { id: 'subdomain-finder', label: 'Subdomain Finder', category: 'security', icon: IconSitemap, isNew: true,
    desc: 'Discover subdomains from Certificate Transparency logs, check which are live and flag dangling CNAMEs.',
    keywords: ['subdomain', 'certificate transparency', 'crt.sh', 'ct logs', 'attack surface', 'recon', 'takeover', 'dns'] },
  { id: 'security-headers', label: 'Security Headers', category: 'security', icon: IconShieldHalf, isNew: true,
    desc: 'Grade HTTP response headers and evaluate Content-Security-Policy.',
    keywords: ['headers', 'csp', 'hsts', 'security', 'content security policy', 'x-frame-options', 'cors'] },

  // ── Network & Web ──
  { id: 'dns-lookup', label: 'DNS & Email Security', category: 'network', icon: IconAt, isNew: true,
    desc: 'DNS records over HTTPS plus SPF, DMARC, MX and CAA checks for a domain.',
    keywords: ['dns', 'lookup', 'spf', 'dmarc', 'mx', 'txt', 'caa', 'email', 'doh'] },
  { id: 'seo-analyzer', label: 'SEO & Performance', category: 'network', icon: IconSeo, isNew: true,
    desc: 'Audit any URL: meta tags, headings, links, structured data, social previews, speed hints, robots.txt, sitemap and Lighthouse.',
    keywords: ['seo', 'performance', 'meta', 'audit', 'lighthouse', 'pagespeed', 'core web vitals', 'open graph', 'sitemap', 'robots'] },
  { id: 'whois-lookup', label: 'WHOIS / RDAP Lookup', category: 'network', icon: IconWorldWww, isNew: true,
    desc: 'Domain registration, expiry and registrar, plus IP / ASN ownership — straight from the registries via RDAP.',
    keywords: ['whois', 'rdap', 'domain', 'registrar', 'expiry', 'ip', 'asn', 'owner', 'abuse'] },
  { id: 'subnet-calculator', label: 'Subnet Calculator', category: 'network', icon: IconNetwork, isNew: true,
    desc: 'IPv4 CIDR calculator — network, broadcast, host range, masks and IP classification.',
    keywords: ['subnet', 'cidr', 'ip', 'ipv4', 'netmask', 'network', 'calculator'] },
];

export const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

// Retired tool URLs that still get a page which forwards to their replacement.
export const TOOL_ALIASES = {
  'css-tools': '/tools/js-formatter/?lang=css',
};

export const toolPath = (id) => `/tools/${id}`;

export const getTool = (id) => TOOL_MAP[id];

export const getToolByPath = (pathname) => {
  const m = pathname?.match(/^\/tools\/([^/]+)/);
  return m ? TOOL_MAP[m[1]] : undefined;
};

export const getCategory = (id) => CATEGORIES.find((c) => c.id === id);

export const toolsByCategory = () =>
  CATEGORIES.map((c) => ({ ...c, tools: TOOLS.filter((t) => t.category === c.id) }));

/** Simple scored search over label, keywords and description. */
export function searchTools(query) {
  const q = query.trim().toLowerCase();
  if (!q) return TOOLS;
  const terms = q.split(/\s+/);
  return TOOLS
    .map((t) => {
      const label = t.label.toLowerCase();
      const hay = `${label} ${t.keywords.join(' ')} ${t.desc.toLowerCase()} ${t.category}`;
      let score = 0;
      for (const term of terms) {
        if (!hay.includes(term)) return null;
        if (label.startsWith(term)) score += 10;
        else if (label.includes(term)) score += 6;
        else if (t.keywords.some((k) => k.startsWith(term))) score += 4;
        else score += 1;
      }
      return { t, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.t);
}
