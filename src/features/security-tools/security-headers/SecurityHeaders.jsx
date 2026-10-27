import { useMemo, useState } from 'react';
import { Stack, Group, Text, Textarea, Table, Badge, SimpleGrid, Tabs, Code, Alert, TextInput, Button } from '@mantine/core';
import { IconShieldHalf, IconTerminal2, IconWorld } from '@tabler/icons-react';
import { Panel, FindingList, Grade, PrivacyNote } from '@/shared/components/ui';
import { inspectUrl, normalizeUrl, ProxyUnavailableError } from '@/shared/lib/proxy';
import FixGuides from '@/shared/components/FixGuides';

const SAMPLE = `HTTP/2 200
content-type: text/html; charset=utf-8
server: nginx/1.18.0
x-powered-by: Express
strict-transport-security: max-age=86400
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.example.com; img-src *
x-content-type-options: nosniff
set-cookie: session=abc123; Path=/; HttpOnly
access-control-allow-origin: *`;

export function parseHeaders(raw) {
  const headers = {};
  const cookies = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const name = m[1].toLowerCase();
    if (name === 'set-cookie') cookies.push(m[2]);
    else headers[name] = headers[name] ? `${headers[name]}, ${m[2]}` : m[2];
  }
  return { headers, cookies };
}

export function parseCsp(policy) {
  const directives = {};
  for (const part of policy.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) directives[name.toLowerCase()] = values;
  }
  return directives;
}

export function evaluateCsp(policy) {
  const f = [];
  const d = parseCsp(policy);
  const script = d['script-src'] || d['default-src'];
  const hasNonceOrHash = script?.some((v) => /^'(nonce|sha256|sha384|sha512)-/.test(v));
  if (!d['default-src']) f.push({ level: 'medium', title: 'No default-src', detail: 'Without a fallback, any directive you forget is unrestricted.' });
  if (!script) f.push({ level: 'high', title: 'Scripts are unrestricted', detail: 'Neither script-src nor default-src is set.' });
  else {
    if (script.includes("'unsafe-inline'") && !hasNonceOrHash && !script.includes("'strict-dynamic'")) f.push({ level: 'high', title: "script-src allows 'unsafe-inline'", detail: 'Inline scripts defeat most of the XSS protection CSP provides. Use nonces or hashes.' });
    if (script.includes("'unsafe-eval'")) f.push({ level: 'medium', title: "script-src allows 'unsafe-eval'", detail: 'eval() and new Function() remain available to attackers.' });
    if (script.some((v) => v === '*' || v === 'https:' || v === 'http:')) f.push({ level: 'high', title: 'script-src allows any origin', detail: 'Wildcards / scheme-only sources let scripts load from anywhere.' });
    if (script.includes('data:')) f.push({ level: 'high', title: 'script-src allows data: URIs', detail: 'Attackers can inject scripts as data: URLs.' });
    if (script.some((v) => /^https?:\/\/[^/]*(googleapis|cdnjs|jsdelivr|unpkg|cloudflare)/.test(v))) f.push({ level: 'low', title: 'Public CDN allow-listed for scripts', detail: 'Public CDNs host JSONP/old libraries that can be abused to bypass CSP.' });
    if (script.some((v) => v.startsWith('http:'))) f.push({ level: 'medium', title: 'Insecure http: script source' });
  }
  if (!d['object-src'] && !(d['default-src'] || []).includes("'none'")) f.push({ level: 'medium', title: "object-src not set to 'none'", detail: 'Plugins (Flash/PDF embeds) can execute script.' });
  if (!d['base-uri']) f.push({ level: 'medium', title: 'No base-uri', detail: "Injected <base> tags can hijack relative script URLs. Use base-uri 'self' or 'none'." });
  if (!d['frame-ancestors']) f.push({ level: 'low', title: 'No frame-ancestors', detail: 'Clickjacking protection relies on X-Frame-Options instead.' });
  if (!d['form-action']) f.push({ level: 'low', title: 'No form-action', detail: 'Forms could post data to any origin.' });
  if (d['upgrade-insecure-requests']) f.push({ level: 'pass', title: 'upgrade-insecure-requests enabled' });
  if (d['report-uri'] || d['report-to']) f.push({ level: 'pass', title: 'Violation reporting configured' });
  return { directives: d, findings: f };
}

// `extra` = findings gathered outside the headers themselves (e.g. HTTP→HTTPS redirect), each with a penalty.
function analyze(raw, extra = []) {
  const { headers: h, cookies } = parseHeaders(raw);
  const f = [];
  let score = 100;
  const add = (level, title, detail, penalty = 0, fix) => { f.push({ level, title, detail, fix }); score -= penalty; };
  extra.forEach((x) => add(x.level, x.title, x.detail, x.penalty || 0, x.fix));

  // HSTS
  const hsts = h['strict-transport-security'];
  if (!hsts) add('high', 'Missing Strict-Transport-Security', 'Browsers may connect over plain HTTP first. Add: max-age=31536000; includeSubDomains; preload', 20, 'hsts');
  else {
    const age = Number((hsts.match(/max-age=(\d+)/i) || [])[1] || 0);
    if (age < 15552000) add('medium', `HSTS max-age is short (${age}s)`, 'Use at least 6 months (15552000), ideally 1 year.', 8, 'hsts');
    else add('pass', 'HSTS enabled', hsts);
    if (!/includesubdomains/i.test(hsts)) add('low', 'HSTS without includeSubDomains', null, 3, 'hsts');
  }

  // CSP
  const csp = h['content-security-policy'];
  let cspResult = null;
  if (!csp) {
    add('high', 'Missing Content-Security-Policy', h['content-security-policy-report-only'] ? 'Only a Report-Only policy is set — it does not block anything.' : 'CSP is the main defense-in-depth layer against XSS.', 20, 'csp');
  } else {
    cspResult = evaluateCsp(csp);
    const bad = cspResult.findings.filter((x) => x.level === 'high').length;
    score -= bad * 7 + cspResult.findings.filter((x) => x.level === 'medium').length * 3;
    if (!bad) add('pass', 'Content-Security-Policy present', `${Object.keys(cspResult.directives).length} directives`);
    else add('medium', `Content-Security-Policy has ${bad} serious weakness(es)`, 'See the CSP panel for details.', 0, 'csp');
  }

  // Framing
  const xfo = h['x-frame-options'];
  const fa = cspResult?.directives['frame-ancestors'];
  if (!xfo && !fa) add('medium', 'No clickjacking protection', "Set X-Frame-Options: DENY or CSP frame-ancestors 'none'.", 10, 'frame');
  else if (xfo && !/^(deny|sameorigin)$/i.test(xfo.trim())) add('low', `Unusual X-Frame-Options value “${xfo}”`, 'ALLOW-FROM is obsolete; use CSP frame-ancestors.', 3, 'frame');
  else add('pass', 'Clickjacking protection', xfo ? `X-Frame-Options: ${xfo}` : `frame-ancestors ${fa.join(' ')}`);

  if (!/nosniff/i.test(h['x-content-type-options'] || '')) add('medium', 'Missing X-Content-Type-Options: nosniff', 'Browsers may MIME-sniff uploads into executable content.', 8, 'nosniff');
  else add('pass', 'X-Content-Type-Options: nosniff');

  const rp = h['referrer-policy'];
  if (!rp) add('low', 'Missing Referrer-Policy', 'Full URLs (with tokens in query strings) can leak to third parties. Use strict-origin-when-cross-origin.', 5, 'referrer');
  else if (/unsafe-url|no-referrer-when-downgrade/i.test(rp)) add('medium', `Weak Referrer-Policy (${rp})`, null, 5, 'referrer');
  else add('pass', `Referrer-Policy: ${rp}`);

  if (!h['permissions-policy']) add('low', 'Missing Permissions-Policy', 'Restrict powerful features: camera=(), microphone=(), geolocation=()', 4, 'permissions');
  if (!h['cross-origin-opener-policy']) add('info', 'No Cross-Origin-Opener-Policy', 'COOP: same-origin isolates your window from cross-origin popups (XS-Leaks, Spectre).', 0, 'coop');

  // CORS
  const acao = h['access-control-allow-origin'];
  if (acao === '*' && /true/i.test(h['access-control-allow-credentials'] || '')) add('critical', 'CORS: wildcard origin with credentials', 'Browsers reject this combo, but it signals a dangerously permissive config.', 25, 'cors');
  else if (acao === '*') add('low', 'CORS allows any origin (*)', 'Fine for public APIs; dangerous if responses contain user data.', 5, 'cors');
  else if (acao === 'null') add('high', 'CORS allows the "null" origin', 'Sandboxed iframes and file:// pages send Origin: null — attackers can too.', 15, 'cors');

  // Information disclosure
  const server = h.server;
  if (server && /\d/.test(server)) add('low', `Server version disclosed: ${server}`, 'Version numbers help attackers pick exploits.', 3, 'disclosure');
  for (const k of ['x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator']) {
    if (h[k]) add('low', `Technology disclosed: ${k}: ${h[k]}`, 'Remove this header.', 3, 'disclosure');
  }
  if (h['x-xss-protection'] && !/^0/.test(h['x-xss-protection'])) add('info', 'X-XSS-Protection is deprecated', 'Modern browsers ignore it; the old auditor could introduce leaks. Set to 0 and rely on CSP.', 0, 'xxss');

  // Cookies
  const cookieRows = cookies.map((c) => {
    const [pair, ...attrs] = c.split(';').map((s) => s.trim());
    const name = pair.split('=')[0];
    const a = attrs.map((x) => x.toLowerCase());
    const secure = a.includes('secure');
    const httpOnly = a.includes('httponly');
    const sameSite = (a.find((x) => x.startsWith('samesite=')) || '').split('=')[1];
    if (!secure) add('medium', `Cookie “${name}” missing Secure`, 'It can be sent over plain HTTP.', 5, 'cookies');
    if (!httpOnly && /sess|token|auth|sid|jwt/i.test(name)) add('medium', `Session-like cookie “${name}” missing HttpOnly`, 'JavaScript (and XSS) can read it.', 5, 'cookies');
    if (!sameSite) add('low', `Cookie “${name}” has no SameSite`, 'Browsers default to Lax, but set it explicitly.', 2, 'cookies');
    else if (sameSite === 'none' && !secure) add('medium', `Cookie “${name}”: SameSite=None without Secure`, 'Browsers reject this cookie.', 3, 'cookies');
    return { name, secure, httpOnly, sameSite: sameSite || '—' };
  });

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 95 ? 'A+' : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
  return { headers: h, findings: f, cookieRows, csp: cspResult, score, grade };
}

function CspTable({ directives }) {
  return (
    <Table striped verticalSpacing={4}>
      <Table.Tbody>
        {Object.entries(directives).map(([k, v]) => (
          <Table.Tr key={k}>
            <Table.Td w={180}><Code>{k}</Code></Table.Td>
            <Table.Td>
              <Group gap={4}>
                {v.length ? v.map((s, i) => (
                  <Badge key={i} size="sm" variant="light" tt="none"
                    color={/unsafe|^\*$|^data:$|^https?:$/.test(s) ? 'red' : /^'(self|none|nonce|sha|strict)/.test(s) ? 'teal' : 'gray'}>{s}</Badge>
                )) : <Text size="xs" c="dimmed">(no value)</Text>}
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function HeaderReport({ raw, extra }) {
  const r = useMemo(() => (raw.trim() ? analyze(raw, extra) : null), [raw, extra]);
  return (
    <>
      {r && (
        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          <Panel title="Grade" icon={IconShieldHalf}>
            <Grade grade={r.grade} label={`Score ${r.score}/100 · ${Object.keys(r.headers).length} headers`} />
            <div className="mt-3"><FindingList findings={r.findings} /></div>
          </Panel>
          <Stack gap="md">
            {r.csp && (
              <Panel title="Content-Security-Policy">
                <CspTable directives={r.csp.directives} />
                <div className="mt-2"><FindingList findings={r.csp.findings} /></div>
              </Panel>
            )}
            {r.cookieRows.length > 0 && (
              <Panel title="Cookies">
                <Table verticalSpacing={4}>
                  <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Secure</Table.Th><Table.Th>HttpOnly</Table.Th><Table.Th>SameSite</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {r.cookieRows.map((c, i) => (
                      <Table.Tr key={i}>
                        <Table.Td><Code>{c.name}</Code></Table.Td>
                        <Table.Td>{c.secure ? '✅' : '❌'}</Table.Td>
                        <Table.Td>{c.httpOnly ? '✅' : '❌'}</Table.Td>
                        <Table.Td>{c.sameSite}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Panel>
            )}
          </Stack>
        </SimpleGrid>
      )}
      {r && <FixGuides findings={r.findings} />}
    </>
  );
}

function RawHeadersInput({ raw, setRaw, label = 'Raw response headers' }) {
  return (
    <Panel title={label} icon={IconTerminal2}>
      <Textarea value={raw} onChange={(e) => setRaw(e.currentTarget.value)} autosize minRows={6} maxRows={16} className="code-font" spellCheck={false} />
      <Text size="xs" c="dimmed" mt={4}>
        Get them with <Code>curl -sI https://your-site.com</Code> or DevTools → Network → select the document → Response Headers → Raw.
      </Text>
    </Panel>
  );
}

function HeadersTab() {
  const [raw, setRaw] = useState(SAMPLE);
  return (
    <Stack gap="md">
      <RawHeadersInput raw={raw} setRaw={setRaw} />
      <HeaderReport raw={raw} />
    </Stack>
  );
}

const toRaw = (status, statusText, headers) => [`HTTP/1.1 ${status} ${statusText || ''}`.trim(), ...headers.map(([k, v]) => `${k}: ${v}`)].join('\n');

// Step 1: a plain browser (AJAX) request — succeeds only when the site sends CORS headers,
// and even then only "CORS-safelisted" response headers are readable.
async function browserAttempt(url) {
  try {
    const res = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', redirect: 'follow', signal: AbortSignal.timeout(10000) });
    const headers = [...res.headers];
    res.body?.cancel();
    return { ok: true, status: res.status, headers };
  } catch (e) {
    return { ok: false, reason: e.name === 'TimeoutError' ? 'timed out' : 'blocked by CORS (the site does not allow cross-origin reads)' };
  }
}

function UrlTab() {
  const [url, setUrl] = useState('https://dev-tools.serversbay.com');
  const [busy, setBusy] = useState(false);
  const [browser, setBrowser] = useState(null);
  const [result, setResult] = useState(null);
  const [raw, setRaw] = useState('');
  const [extra, setExtra] = useState([]);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true); setError(null); setResult(null); setBrowser(null); setRaw(''); setExtra([]);
    let target;
    try { target = normalizeUrl(url); } catch (e) { setError(e.message); setBusy(false); return; }
    const b = await browserAttempt(target);
    setBrowser(b);
    try {
      const r = await inspectUrl(target);
      const findings = [];
      if (!r.finalUrl.startsWith('https://')) findings.push({ level: 'high', title: 'Final page is not served over HTTPS', detail: r.finalUrl, penalty: 20, fix: 'https-redirect' });
      if (r.redirects.length > 2) findings.push({ level: 'low', title: `${r.redirects.length} redirects before the page loads`, detail: 'Each hop adds latency.', penalty: 2 });
      // Does plain HTTP upgrade to HTTPS?
      const u = new URL(r.finalUrl);
      if (u.protocol === 'https:') {
        try {
          const http = await inspectUrl(`http://${u.host}${u.pathname}`);
          const first = http.redirects[0];
          if (!first) findings.push({ level: 'high', title: 'HTTP does not redirect to HTTPS', detail: `http://${u.host} answers ${http.status} without redirecting.`, penalty: 15, fix: 'https-redirect' });
          else if (!first.location.startsWith('https://')) findings.push({ level: 'medium', title: 'First HTTP redirect is not to HTTPS', detail: `${first.status} → ${first.location}`, penalty: 8, fix: 'https-redirect' });
          else findings.push({ level: 'pass', title: `HTTP redirects to HTTPS (${first.status})` });
        } catch { /* http:// not reachable — common when only 443 is open */ }
      }
      setExtra(findings);
      setResult(r);
      setRaw(toRaw(r.status, r.statusText, r.headers));
    } catch (e) {
      setError(e);
    }
    setBusy(false);
  };

  return (
    <Stack gap="md">
      <Panel>
        <Group align="flex-end">
          <TextInput size="md" label="Website URL" value={url} onChange={(e) => setUrl(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && run()}
            leftSection={<IconWorld size={16} />} style={{ flex: 1 }} className="code-font" />
          <Button size="md" onClick={run} loading={busy} leftSection={<IconShieldHalf size={16} />}>Check headers</Button>
        </Group>
      </Panel>

      {browser && (
        <Alert color={browser.ok ? 'teal' : 'gray'} p="xs" title="1 · Direct browser request (AJAX)">
          <Text size="xs">
            {browser.ok
              ? `Allowed by CORS (HTTP ${browser.status}) — but the browser only exposes ${browser.headers.length} header(s): ${browser.headers.map(([k]) => k).join(', ') || 'none'}. Security headers are hidden from JavaScript, so the full check uses the DevForge proxy.`
              : `${browser.reason}. That's normal — browsers hide other sites' headers. Using the DevForge proxy instead.`}
          </Text>
        </Alert>
      )}

      {error && (
        <Alert color={error instanceof ProxyUnavailableError ? 'orange' : 'red'} title="2 · DevForge proxy">
          <Text size="sm">{error.message}</Text>
          {error instanceof ProxyUnavailableError && <Text size="xs" mt={4}>You can still paste the headers in the “Paste raw headers” tab.</Text>}
        </Alert>
      )}

      {result && (
        <Panel title="2 · Fetched via DevForge proxy" actions={<>
          <Badge variant="light" color={result.status < 400 ? 'teal' : 'red'}>HTTP {result.status}</Badge>
          <Badge variant="light" color="gray">{result.ttfbMs} ms TTFB</Badge>
        </>}>
          {result.redirects.length > 0 && (
            <Table verticalSpacing={3} mb="sm">
              <Table.Tbody>
                {result.redirects.map((r, i) => (
                  <Table.Tr key={i}>
                    <Table.Td w={60}><Badge size="xs" variant="outline">{r.status}</Badge></Table.Td>
                    <Table.Td><Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>{r.url} → {r.location}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          <Text size="xs" c="dimmed">Final URL: <Text span ff="monospace" size="xs">{result.finalUrl}</Text> · cookie values are masked by the proxy.</Text>
        </Panel>
      )}

      {raw && <HeaderReport raw={raw} extra={extra} />}
      {raw && <RawHeadersInput raw={raw} setRaw={setRaw} label="Fetched headers (editable — the report updates live)" />}
    </Stack>
  );
}

function CspTab() {
  const [policy, setPolicy] = useState("default-src 'self'; script-src 'self' 'nonce-r4nd0m'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests");
  const r = useMemo(() => (policy.trim() ? evaluateCsp(policy) : null), [policy]);
  return (
    <Stack gap="md">
      <Textarea label="Content-Security-Policy value" value={policy} onChange={(e) => setPolicy(e.currentTarget.value)} autosize minRows={3} className="code-font" />
      {r && (
        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          <Panel title="Directives"><CspTable directives={r.directives} /></Panel>
          <Panel title="Evaluation">
            {r.findings.filter((x) => x.level !== 'pass').length === 0 && <Alert color="teal" p="xs" mb="xs">Strong policy — no weaknesses detected.</Alert>}
            <FindingList findings={r.findings} />
          </Panel>
        </SimpleGrid>
      )}
      {r && <FixGuides findings={r.findings.filter((x) => !['pass', 'info'].includes(x.level)).map((x) => ({ ...x, fix: 'csp' }))} />}
    </Stack>
  );
}

export default function SecurityHeaders() {
  const [tab, setTab] = useState('url');
  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="url" leftSection={<IconWorld size={14} />}>Check a URL</Tabs.Tab>
          <Tabs.Tab value="headers" leftSection={<IconTerminal2 size={14} />}>Paste raw headers</Tabs.Tab>
          <Tabs.Tab value="csp">CSP evaluator</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'url' && <UrlTab />}
      {tab === 'headers' && <HeadersTab />}
      {tab === 'csp' && <CspTab />}
      <PrivacyNote>
        URL checks first try a direct browser request, then the DevForge proxy (a Cloudflare Worker that returns only status and headers, with cookie values masked). Pasted headers never leave your browser.
      </PrivacyNote>
    </Stack>
  );
}
