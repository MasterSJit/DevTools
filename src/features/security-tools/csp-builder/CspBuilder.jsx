import { useMemo, useState } from 'react';
import { Stack, SimpleGrid, SegmentedControl, TagsInput, Switch, Text, Textarea, Group, Badge, Select, Button } from '@mantine/core';
import { Panel, OutputArea, FindingList, Grade, PrivacyNote } from '@/shared/components/ui';

const DIRECTIVES = [
  ['default-src', 'Fallback for every fetch directive not listed.'],
  ['script-src', 'JavaScript sources. The most important directive against XSS.'],
  ['style-src', 'Stylesheets and inline styles.'],
  ['img-src', 'Images and favicons.'],
  ['connect-src', 'fetch / XHR / WebSocket / EventSource targets.'],
  ['font-src', 'Web fonts.'],
  ['media-src', 'Audio and video.'],
  ['frame-src', 'Pages you embed in iframes.'],
  ['worker-src', 'Web / service workers.'],
  ['manifest-src', 'Web app manifest.'],
  ['object-src', 'Plugins (<object>, <embed>). Should be \'none\'.'],
  ['base-uri', 'Restricts <base href> — stops base-tag hijacking.'],
  ['form-action', 'Where forms may submit.'],
  ['frame-ancestors', 'Who may iframe YOUR page (clickjacking). Not allowed in <meta>.'],
];

const KEYWORDS = ["'self'", "'none'", "'unsafe-inline'", "'unsafe-eval'", "'strict-dynamic'", "'wasm-unsafe-eval'", "'unsafe-hashes'", "'report-sample'", 'https:', 'data:', 'blob:', '*'];

const PRESETS = {
  'Strict (nonce-based)': {
    'default-src': ["'self'"], 'script-src': ["'nonce-{RANDOM}'", "'strict-dynamic'"], 'style-src': ["'self'"], 'img-src': ["'self'", 'data:'],
    'object-src': ["'none'"], 'base-uri': ["'none'"], 'form-action': ["'self'"], 'frame-ancestors': ["'none'"],
  },
  'Static site': {
    'default-src': ["'self'"], 'script-src': ["'self'"], 'style-src': ["'self'"], 'img-src': ["'self'", 'data:'], 'font-src': ["'self'"],
    'connect-src': ["'self'"], 'object-src': ["'none'"], 'base-uri': ["'self'"], 'form-action': ["'self'"], 'frame-ancestors': ["'none'"],
  },
  'SPA + API': {
    'default-src': ["'self'"], 'script-src': ["'self'"], 'style-src': ["'self'", "'unsafe-inline'"], 'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'", 'https://api.example.com'], 'font-src': ["'self'"], 'object-src': ["'none'"], 'base-uri': ["'self'"], 'frame-ancestors': ["'self'"],
  },
};

// Hosts that serve JSONP / user-controlled JS or old Angular, letting attackers bypass a host allow-list.
const BYPASS_HOSTS = ['*.googleapis.com', 'ajax.googleapis.com', 'www.google.com', '*.google.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net',
  'unpkg.com', '*.cloudfront.net', '*.amazonaws.com', 'raw.githubusercontent.com', '*.github.io', '*.herokuapp.com', '*.firebaseapp.com',
  'accounts.google.com', 'www.youtube.com', 'code.jquery.com', '*.azurewebsites.net', 'storage.googleapis.com'];

export function parseCsp(str) {
  const out = {};
  str.split(';').map((s) => s.trim()).filter(Boolean).forEach((d) => {
    const [name, ...vals] = d.split(/\s+/);
    const k = name.toLowerCase();
    if (!(k in out)) out[k] = vals; // browsers ignore duplicate directives
  });
  return out;
}

export function evaluateCsp(p) {
  const f = [];
  const eff = (d) => p[d] || p['default-src'];
  const script = eff('script-src');
  const hasNonceOrHash = script?.some((v) => /^'(nonce-|sha(256|384|512)-)/.test(v));
  const strictDynamic = script?.includes("'strict-dynamic'");
  if (!script) f.push({ level: 'critical', title: 'No script-src or default-src', detail: 'Any script from anywhere can run — the policy gives no XSS protection.' });
  else {
    if (script.includes("'unsafe-inline'") && !hasNonceOrHash) f.push({ level: 'high', title: "script-src allows 'unsafe-inline'", detail: 'Injected <script> tags and event handlers will run. Use nonces or hashes instead.' });
    if (script.includes("'unsafe-eval'")) f.push({ level: 'medium', title: "script-src allows 'unsafe-eval'", detail: "eval() / new Function() are allowed. Use 'wasm-unsafe-eval' if you only need WebAssembly." });
    if (script.some((v) => v === '*' || v === 'https:' || v === 'http:')) f.push({ level: 'high', title: 'script-src allows any host', detail: 'Wildcard / scheme sources let attackers load script from their own server.' });
    if (script.includes('data:')) f.push({ level: 'high', title: 'script-src allows data: URIs', detail: 'An attacker can inline a script as data:text/javascript.' });
    if (script.some((v) => v.startsWith('http:'))) f.push({ level: 'medium', title: 'script-src allows http:// sources', detail: 'Scripts over plain HTTP can be modified in transit.' });
    if (!strictDynamic) {
      script.filter((v) => BYPASS_HOSTS.some((b) => v.replace(/^https?:\/\//, '').startsWith(b.replace('*.', '')) || v.includes(b)))
        .forEach((v) => f.push({ level: 'medium', title: `Allow-listed host can bypass CSP: ${v}`, detail: 'This host serves JSONP, user uploads or old libraries (e.g. AngularJS) that can execute attacker code.' }));
    }
    if (hasNonceOrHash && strictDynamic) f.push({ level: 'pass', title: 'Nonce/hash + strict-dynamic', detail: 'This is the recommended modern CSP.' });
  }
  const obj = eff('object-src');
  if (!obj || !obj.includes("'none'")) f.push({ level: 'medium', title: "object-src is not 'none'", detail: 'Plugins can still be used to run script.' });
  if (!p['base-uri']) f.push({ level: 'medium', title: 'Missing base-uri', detail: "Injected <base> tags can redirect relative script URLs. Use base-uri 'none' or 'self'." });
  if (!p['frame-ancestors']) f.push({ level: 'low', title: 'Missing frame-ancestors', detail: "Page can be framed (clickjacking). Add frame-ancestors 'none' or 'self'." });
  if (!p['form-action']) f.push({ level: 'low', title: 'Missing form-action', detail: 'Injected forms can post data to any site.' });
  if (p['report-uri'] && !p['report-to']) f.push({ level: 'info', title: 'report-uri is deprecated', detail: 'Add report-to alongside it.' });
  const style = eff('style-src');
  if (style?.includes("'unsafe-inline'")) f.push({ level: 'info', title: "style-src allows 'unsafe-inline'", detail: 'Low risk on its own, but enables CSS-based data exfiltration.' });
  if (!f.some((x) => ['critical', 'high', 'medium'].includes(x.level))) f.unshift({ level: 'pass', title: 'No significant weaknesses found' });
  return f;
}

const gradeOf = (f) => {
  const s = f.reduce((n, x) => n - ({ critical: 50, high: 25, medium: 10, low: 4 }[x.level] || 0), 100);
  return s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 60 ? 'C' : s >= 40 ? 'D' : 'F';
};

const serialize = (p, upgrade, report) => [
  ...Object.entries(p).filter(([, v]) => v.length).map(([k, v]) => `${k} ${v.join(' ')}`),
  upgrade && 'upgrade-insecure-requests',
  report && `report-uri ${report}`,
].filter(Boolean).join('; ');

export default function CspBuilder() {
  const [mode, setMode] = useState('build');
  const [policy, setPolicy] = useState(PRESETS['Static site']);
  const [upgrade, setUpgrade] = useState(true);
  const [report, setReport] = useState('');
  const [reportOnly, setReportOnly] = useState(false);
  const [pasted, setPasted] = useState("default-src 'self'; script-src 'self' 'unsafe-inline' https://ajax.googleapis.com; img-src *");

  const csp = serialize(policy, upgrade, report);
  const evaluated = useMemo(() => (mode === 'build' ? policy : parseCsp(pasted)), [mode, policy, pasted]);
  const findings = useMemo(() => evaluateCsp(evaluated), [evaluated]);
  const header = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  const value = mode === 'build' ? csp : pasted.trim();
  const metaValue = value.replace(/;\s*frame-ancestors[^;]*/i, '').replace(/;\s*report-uri[^;]*/i, '');

  const outputs = [
    `${header}: ${value}`,
    '',
    '# Nginx',
    `add_header ${header} "${value}" always;`,
    '',
    '# Apache',
    `Header always set ${header} "${value}"`,
    '',
    '# HTML <meta> (frame-ancestors / report-uri are ignored here)',
    `<meta http-equiv="Content-Security-Policy" content="${metaValue.replace(/"/g, '&quot;')}">`,
  ].join('\n');

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <SegmentedControl value={mode} onChange={setMode} data={[{ value: 'build', label: 'Build a policy' }, { value: 'eval', label: 'Evaluate a policy' }]} />
        <Grade grade={gradeOf(findings)} label="Policy grade" />
      </Group>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        {mode === 'build' ? (
          <Panel title="Directives" actions={
            <Select size="xs" w={190} placeholder="Load preset…" data={Object.keys(PRESETS)} value={null} onChange={(v) => v && setPolicy(PRESETS[v])} />
          }>
            <Stack gap="xs">
              {DIRECTIVES.map(([d, help]) => (
                <TagsInput key={d} size="xs" label={<Group gap={6}><Text size="xs" ff="monospace" fw={700}>{d}</Text></Group>} description={help}
                  data={KEYWORDS} value={policy[d] || []} clearable splitChars={[' ', ',']}
                  onChange={(v) => setPolicy((p) => ({ ...p, [d]: v.map((x) => x.trim()).filter(Boolean) }))} />
              ))}
              <Switch size="sm" label="upgrade-insecure-requests" checked={upgrade} onChange={(e) => setUpgrade(e.currentTarget.checked)} />
              <Switch size="sm" label="Report-only mode (test without breaking the site)" checked={reportOnly} onChange={(e) => setReportOnly(e.currentTarget.checked)} />
              <TagsInput size="xs" label="report-uri" maxTags={1} value={report ? [report] : []} onChange={(v) => setReport(v[0] || '')} placeholder="https://example.report-uri.com/r/d/csp" />
              <Button size="compact-xs" variant="subtle" onClick={() => setPolicy((p) => ({ ...p, 'script-src': (p['script-src'] || []).filter((x) => !x.startsWith("'nonce-")).concat(`'nonce-${btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))}'`) }))}>
                Add a random nonce to script-src
              </Button>
            </Stack>
          </Panel>
        ) : (
          <Panel title="Paste a Content-Security-Policy">
            <Textarea value={pasted} onChange={(e) => setPasted(e.currentTarget.value)} autosize minRows={6} className="code-font" spellCheck={false} />
            <Group gap={4} mt="sm">{Object.keys(evaluated).map((k) => <Badge key={k} size="sm" variant="light" tt="none">{k}</Badge>)}</Group>
          </Panel>
        )}
        <Stack gap="md">
          <Panel title="Findings"><FindingList findings={findings} /></Panel>
          <OutputArea label="Header & server config" value={outputs} minRows={8} filename="csp.txt" />
        </Stack>
      </SimpleGrid>
      <Text size="xs" c="dimmed">Nonces must be random per response and generated by your server — a fixed nonce gives no protection. Roll out with Report-Only first.</Text>
      <PrivacyNote />
    </Stack>
  );
}
