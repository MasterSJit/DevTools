import { useState } from 'react';
import {
  Stack, Group, Button, Text, TextInput, Textarea, Badge, SimpleGrid, Alert, Table, Tabs, RingProgress, Paper, SegmentedControl,
  PasswordInput, Anchor, Code, ScrollArea,
} from '@mantine/core';
import { IconSearch, IconWorld, IconGauge, IconBrandGoogle, IconShare, IconListTree, IconCode, IconBolt } from '@tabler/icons-react';
import { Panel, FindingList, KVTable } from '@/shared/components/ui';
import { inspectUrl, normalizeUrl, ProxyUnavailableError } from '@/shared/lib/proxy';
import { formatBytes } from '@/shared/lib/download';
import { analyzeSeo, parseSitemap } from './seoChecks';

const color = (s) => (s >= 90 ? 'teal' : s >= 70 ? 'lime' : s >= 50 ? 'orange' : 'red');
const PSI_KEY = 'devforge-psi-key';

function ScoreRing({ label, value, size = 92 }) {
  return (
    <Stack gap={2} align="center">
      <RingProgress size={size} thickness={8} roundCaps sections={[{ value, color: color(value) }]}
        label={<Text ta="center" fw={700} size={size > 100 ? 'xl' : 'md'}>{value}</Text>} />
      <Text size="xs" c="dimmed" fw={500}>{label}</Text>
    </Stack>
  );
}

function SerpPreview({ url, title, description }) {
  const u = new URL(url);
  return (
    <Paper p="md" style={{ fontFamily: 'arial, sans-serif' }}>
      <Text size="xs" c="dimmed">{u.hostname} › {u.pathname.split('/').filter(Boolean).join(' › ')}</Text>
      <Text size="lg" c="#1a0dab" style={{ lineHeight: 1.3 }} lineClamp={1}>{title || '(no title)'}</Text>
      <Text size="sm" c="dimmed" lineClamp={2}>{description || 'No meta description — Google will pick text from the page.'}</Text>
    </Paper>
  );
}

function SocialPreview({ og, url, fallbackTitle, fallbackDesc }) {
  const [imgOk, setImgOk] = useState(true);
  let img = null;
  try { img = og.image ? new URL(og.image, url).href : null; } catch {}
  return (
    <Paper p={0} style={{ overflow: 'hidden', maxWidth: 520 }}>
      {img && imgOk ? (
        // crossOrigin is required under this site's COEP policy; servers without CORS simply show no image
        <img src={img} alt="og:image" crossOrigin="anonymous" onError={() => setImgOk(false)} style={{ width: '100%', aspectRatio: '1.91', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div className="df-checker flex items-center justify-center" style={{ aspectRatio: '1.91' }}>
          <Text size="xs" c="dimmed">{img ? 'og:image set (preview blocked by the image host’s CORS policy)' : 'No og:image'}</Text>
        </div>
      )}
      <div className="p-3">
        <Text size="xs" c="dimmed" tt="uppercase">{new URL(url).hostname}</Text>
        <Text fw={600} size="sm" lineClamp={2}>{og.title || fallbackTitle || '(no title)'}</Text>
        <Text size="xs" c="dimmed" lineClamp={2}>{og.description || fallbackDesc}</Text>
      </div>
    </Paper>
  );
}

function Lighthouse({ url }) {
  const [key, setKey] = useState(() => { try { return localStorage.getItem(PSI_KEY) || ''; } catch { return ''; } });
  const [strategy, setStrategy] = useState('mobile');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true); setError(null); setRes(null);
    try { localStorage.setItem(PSI_KEY, key); } catch {}
    try {
      const params = new URLSearchParams({ url, strategy });
      ['PERFORMANCE', 'SEO', 'ACCESSIBILITY', 'BEST_PRACTICES'].forEach((c) => params.append('category', c));
      if (key) params.set('key', key);
      const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, { signal: AbortSignal.timeout(90000) });
      const j = await r.json();
      if (!r.ok) throw new Error(r.status === 429 ? 'Google’s shared quota is exhausted — add your own free PageSpeed API key.' : j.error?.message || `HTTP ${r.status}`);
      const lh = j.lighthouseResult;
      const audit = (id) => lh.audits[id]?.displayValue || '—';
      setRes({
        scores: Object.fromEntries(Object.entries(lh.categories).map(([k, c]) => [k, Math.round((c.score || 0) * 100)])),
        lab: [['First Contentful Paint', audit('first-contentful-paint')], ['Largest Contentful Paint', audit('largest-contentful-paint')], ['Total Blocking Time', audit('total-blocking-time')], ['Cumulative Layout Shift', audit('cumulative-layout-shift')], ['Speed Index', audit('speed-index')]],
        field: j.loadingExperience?.metrics ? Object.entries(j.loadingExperience.metrics).map(([k, m]) => [k.replace(/_/g, ' ').toLowerCase(), `${m.percentile}${/CLS/.test(k) ? '' : ' ms'} (${m.category.toLowerCase()})`]) : [],
        opportunities: Object.values(lh.audits).filter((a) => a.details?.type === 'opportunity' && a.score !== null && a.score < 0.9).sort((a, b) => (b.details.overallSavingsMs || 0) - (a.details.overallSavingsMs || 0)).slice(0, 8),
      });
    } catch (e) { setError(e.name === 'TimeoutError' ? 'Lighthouse took longer than 90 s.' : e.message); }
    setBusy(false);
  };

  return (
    <Panel title="Real-browser performance (Google Lighthouse)" icon={IconBolt}>
      <Text size="xs" c="dimmed" mb="sm">
        Runs Lighthouse on Google&apos;s servers via the PageSpeed Insights API (sends the URL to Google). Without a key the shared quota is usually exhausted —
        get a free key at <Anchor size="xs" href="https://developers.google.com/speed/docs/insights/v5/get-started" target="_blank" rel="noopener noreferrer">developers.google.com</Anchor>. The key is stored only in this browser.
      </Text>
      <Group align="flex-end">
        <PasswordInput size="xs" label="PageSpeed API key (optional)" value={key} onChange={(e) => setKey(e.currentTarget.value)} w={280} />
        <SegmentedControl size="xs" value={strategy} onChange={setStrategy} data={[{ value: 'mobile', label: 'Mobile' }, { value: 'desktop', label: 'Desktop' }]} />
        <Button size="xs" onClick={run} loading={busy} leftSection={<IconGauge size={14} />}>Run Lighthouse</Button>
      </Group>
      {busy && <Text size="xs" c="dimmed" mt="xs">Lighthouse usually takes 15–40 seconds…</Text>}
      {error && <Alert color="orange" p="xs" mt="sm">{error}</Alert>}
      {res && (
        <Stack gap="md" mt="md">
          <Group gap="xl">
            {Object.entries(res.scores).map(([k, v]) => <ScoreRing key={k} label={k.replace(/-/g, ' ')} value={v} size={80} />)}
          </Group>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <div><Text size="xs" fw={700} c="dimmed" mb={4}>LAB METRICS</Text><KVTable rows={res.lab.map(([k, v]) => [k, v, { copy: false }])} labelWidth={190} /></div>
            <div>
              <Text size="xs" fw={700} c="dimmed" mb={4}>REAL USERS (CHROME UX REPORT)</Text>
              {res.field.length ? <KVTable rows={res.field.map(([k, v]) => [k, v, { copy: false }])} labelWidth={190} /> : <Text size="xs" c="dimmed">Not enough real-user traffic data for this URL.</Text>}
            </div>
          </SimpleGrid>
          {res.opportunities.length > 0 && (
            <div>
              <Text size="xs" fw={700} c="dimmed" mb={4}>TOP OPPORTUNITIES</Text>
              {res.opportunities.map((o) => (
                <Group key={o.id} justify="space-between" wrap="nowrap" py={3}>
                  <Text size="sm">{o.title}</Text>
                  <Badge variant="light" color="orange" style={{ flexShrink: 0 }}>{o.displayValue || 'improve'}</Badge>
                </Group>
              ))}
            </div>
          )}
        </Stack>
      )}
    </Panel>
  );
}

function Report({ r, url, response }) {
  const [tab, setTab] = useState('seo');
  const tabs = [['seo', 'SEO'], ['performance', 'Performance'], ['bestPractices', 'Best practices'], ['social', 'Social']];
  const problems = (k) => r.findings[k].filter((f) => !['pass', 'info'].includes(f.level)).length;
  return (
    <Stack gap="md">
      <Paper p="md">
        <Group justify="space-between" wrap="wrap" gap="lg">
          <Group gap="xl" wrap="wrap">
            <ScoreRing label="Overall" value={r.overall} size={120} />
            <ScoreRing label="SEO" value={r.scores.seo} />
            <ScoreRing label="Performance" value={r.scores.performance} />
            <ScoreRing label="Best practices" value={r.scores.bestPractices} />
            <ScoreRing label="Social" value={r.scores.social} />
          </Group>
          {response && (
            <Stack gap={4} align="flex-end">
              <Badge color={response.status < 400 ? 'teal' : 'red'} variant="light">HTTP {response.status}</Badge>
              {response.ttfbMs != null && <Badge variant="light" color="gray">TTFB {response.ttfbMs} ms</Badge>}
              <Badge variant="light" color="gray">{formatBytes(r.stats.sizeBytes)} HTML</Badge>
              <Badge variant="light" color="gray">{r.stats.words.toLocaleString()} words</Badge>
            </Stack>
          )}
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title="Google search preview" icon={IconBrandGoogle}><SerpPreview url={url} title={r.meta.title} description={r.meta.description} /></Panel>
        <Panel title="Social share preview" icon={IconShare}><SocialPreview og={r.og} url={url} fallbackTitle={r.meta.title} fallbackDesc={r.meta.description} /></Panel>
      </SimpleGrid>

      <Panel title="What to improve">
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List>
            {tabs.map(([k, l]) => (
              <Tabs.Tab key={k} value={k} rightSection={problems(k) ? <Badge size="xs" color="orange" variant="light">{problems(k)}</Badge> : <Badge size="xs" color="teal" variant="light">✓</Badge>}>{l}</Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
        <div className="mt-3"><FindingList findings={r.findings[tab]} empty="Nothing to report." /></div>
      </Panel>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title="Meta tags" icon={IconCode}>
          <KVTable labelWidth={110} rows={[
            ['Title', r.meta.title || '—', { mono: false }],
            ['Description', r.meta.description || '—', { mono: false }],
            ['Canonical', r.meta.canonical || '—'],
            ['Robots', r.meta.robots || '(default: index, follow)'],
            ['Language', r.meta.lang || '—'],
            ['Viewport', r.meta.viewport || '—'],
            r.meta.hreflang.length > 0 && ['hreflang', r.meta.hreflang.join('\n')],
            ['og:type', r.og.type || '—'],
            ['twitter:card', r.og.twitterCard || '—'],
            ['Structured data', r.structured.flatMap((x) => x.types || ['invalid']).join(', ') || '—'],
            ['Links', `${r.links.internal} internal · ${r.links.external} external · ${r.links.nofollow} nofollow`, { copy: false }],
            ['Resources', `${r.stats.scripts} scripts · ${r.stats.stylesheets} stylesheets · ${r.stats.images} images`, { copy: false }],
          ]} />
        </Panel>
        <Panel title={`Heading outline (${r.headings.length})`} icon={IconListTree}>
          <ScrollArea.Autosize mah={360}>
            {r.headings.length ? r.headings.map((h, i) => (
              <Text key={i} size="sm" style={{ paddingLeft: (h.level - 1) * 16 }} py={1}>
                <Code>H{h.level}</Code> {h.text || <Text span c="dimmed">(empty)</Text>}
              </Text>
            )) : <Text size="sm" c="dimmed">No headings.</Text>}
          </ScrollArea.Autosize>
          {r.images.missingAlt.length > 0 && (
            <>
              <Text size="xs" fw={700} c="dimmed" mt="md" mb={4}>IMAGES MISSING ALT</Text>
              <Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>{r.images.missingAlt.slice(0, 12).join('\n')}</Text>
            </>
          )}
        </Panel>
      </SimpleGrid>
      {response && <Lighthouse url={url} />}
    </Stack>
  );
}

function UrlMode() {
  const [url, setUrl] = useState('https://dev-tools.serversbay.com');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setBusy(true); setError(null); setData(null);
    try {
      const target = normalizeUrl(url);
      setStep('Fetching page…');
      const page = await inspectUrl(target, { body: true });
      if (!page.body) throw new Error(`The URL returned ${page.contentType || 'no content'} (HTTP ${page.status}), not an HTML page.`);
      setStep('Checking robots.txt and sitemap…');
      const origin = new URL(page.finalUrl).origin;
      const robots = await inspectUrl(`${origin}/robots.txt`, { body: true }).catch(() => null);
      const robotsTxt = robots && robots.status === 200 && robots.body && !/<html/i.test(robots.body) ? robots.body : false;
      const sitemapUrl = (robotsTxt && (robotsTxt.match(/^\s*sitemap:\s*(\S+)/im) || [])[1]) || `${origin}/sitemap.xml`;
      const sm = await inspectUrl(sitemapUrl, { body: true }).catch(() => null);
      const sitemap = sm && sm.status === 200 && sm.body ? parseSitemap(sm.body) : false;
      const report = analyzeSeo({
        html: page.body, url: page.finalUrl, status: page.status, headers: page.headers, ttfbMs: page.ttfbMs,
        bodyBytes: page.bodyBytes, redirects: page.redirects, robotsTxt, sitemap,
      });
      setData({ report, page });
    } catch (e) { setError(e); }
    setBusy(false); setStep('');
  };

  return (
    <Stack gap="md">
      <Panel>
        <Group align="flex-end">
          <TextInput size="md" label="Page URL" value={url} onChange={(e) => setUrl(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && run()}
            leftSection={<IconWorld size={16} />} style={{ flex: 1 }} className="code-font" />
          <Button size="md" onClick={run} loading={busy} leftSection={<IconSearch size={16} />}>Analyze</Button>
        </Group>
        {busy && <Text size="xs" c="dimmed" mt="xs">{step}</Text>}
      </Panel>
      {error && (
        <Alert color={error instanceof ProxyUnavailableError ? 'orange' : 'red'}>
          {error.message}
          {error instanceof ProxyUnavailableError && <Text size="xs" mt={4}>Use the “Paste HTML” tab to analyze a page without the proxy.</Text>}
        </Alert>
      )}
      {data && <Report r={data.report} url={data.page.finalUrl} response={data.page} />}
    </Stack>
  );
}

function PasteMode() {
  const [html, setHtml] = useState('');
  const [url, setUrl] = useState('https://example.com/');
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const run = () => {
    setError(null);
    try { setReport(analyzeSeo({ html, url: normalizeUrl(url) })); } catch (e) { setError(e.message); }
  };
  return (
    <Stack gap="md">
      <Panel>
        <Stack gap="sm">
          <TextInput label="Page URL (used to resolve relative links)" value={url} onChange={(e) => setUrl(e.currentTarget.value)} className="code-font" />
          <Textarea label="Page HTML (View Source → copy all)" value={html} onChange={(e) => setHtml(e.currentTarget.value)} autosize minRows={8} maxRows={18} className="code-font" />
          <Group><Button onClick={run} disabled={!html.trim()}>Analyze HTML</Button></Group>
          <Text size="xs" c="dimmed">Runs completely offline. Server-side checks (TTFB, compression, robots.txt, sitemap) need the URL mode.</Text>
        </Stack>
      </Panel>
      {error && <Alert color="red">{error}</Alert>}
      {report && <Report r={report} url={normalizeUrl(url)} />}
    </Stack>
  );
}

export default function SeoAnalyzer() {
  const [tab, setTab] = useState('url');
  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="url" leftSection={<IconWorld size={14} />}>Analyze a URL</Tabs.Tab>
          <Tabs.Tab value="paste" leftSection={<IconCode size={14} />}>Paste HTML</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'url' ? <UrlMode /> : <PasteMode />}
      <Text size="xs" c="dimmed">
        URL mode fetches the page, robots.txt and sitemap through the DevForge proxy (Cloudflare Worker); the HTML is parsed in your browser without running any of its scripts.
      </Text>
    </Stack>
  );
}
