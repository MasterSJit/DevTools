import { useMemo, useState } from 'react';
import { Stack, Group, Text, Textarea, Badge, SimpleGrid, Table, Alert, Button } from '@mantine/core';
import { IconWorldSearch, IconShieldCheck, IconBiohazard } from '@tabler/icons-react';
import CopyButton from '@/shared/components/CopyButton';
import { Panel, KVTable, FindingList, Grade, PrivacyNote } from '@/shared/components/ui';
import { hostToUnicode } from '@/shared/lib/encoding';

const SUSPICIOUS_TLDS = ['zip', 'mov', 'xyz', 'top', 'tk', 'ml', 'ga', 'cf', 'gq', 'click', 'country', 'kim', 'work', 'support', 'rest', 'fit', 'loan', 'men', 'date', 'review', 'cam', 'icu', 'buzz', 'monster', 'quest'];
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'shorturl.at', 'rb.gy', 't.ly', 'tiny.cc', 'lnkd.in'];
const BRANDS = ['paypal', 'apple', 'icloud', 'microsoft', 'office365', 'outlook', 'google', 'gmail', 'amazon', 'netflix', 'facebook', 'instagram', 'whatsapp', 'linkedin', 'dropbox', 'docusign', 'chase', 'wellsfargo', 'bankofamerica', 'hsbc', 'sbi', 'icici', 'hdfc', 'paytm', 'coinbase', 'binance', 'metamask', 'steam', 'adobe', 'dhl', 'fedex', 'ups', 'usps'];
const REDIRECT_PARAMS = ['url', 'redirect', 'redirect_uri', 'redirect_url', 'next', 'return', 'returnurl', 'return_to', 'continue', 'dest', 'destination', 'goto', 'target', 'r', 'u'];
const RISKY_EXT = /\.(exe|scr|msi|bat|cmd|ps1|vbs|js|jar|apk|dmg|pkg|hta|lnk|iso|img)$/i;
// Common Cyrillic/Greek look-alikes of Latin letters
const CONFUSABLE = /[аеорсухіјԁһӏոսԝѕɡαοερτνκιЅІ]/i;

export const defang = (s) => s.replace(/^http/i, 'hxxp').replace(/\./g, '[.]').replace(/:\/\//, '[://]');
export const refang = (s) => s.trim().replace(/^hxxp/i, 'http').replace(/\[\.\]|\(\.\)|\{\.\}/g, '.').replace(/\[:\/\/\]/g, '://').replace(/\[:\]/g, ':');

function parseIpHost(host) {
  if (/^\[.*\]$/.test(host)) return { kind: 'IPv6 literal' };
  if (/^\d+$/.test(host)) return { kind: 'decimal-encoded IPv4', value: [24, 16, 8, 0].map((s) => (Number(host) >>> s) & 255).join('.') };
  if (/^0x[0-9a-f]+$/i.test(host)) return { kind: 'hex-encoded IPv4', value: [24, 16, 8, 0].map((s) => (parseInt(host, 16) >>> s) & 255).join('.') };
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return { kind: 'IPv4 address' };
  if (/^(0[0-7]*|\d+|0x[0-9a-f]+)(\.(0[0-7]*|\d+|0x[0-9a-f]+)){1,3}$/i.test(host)) return { kind: 'obfuscated IPv4 (octal/hex parts)' };
  return null;
}

function analyze(raw) {
  const f = [];
  const input = refang(raw);
  if (/^\s*(javascript|data|vbscript):/i.test(input)) {
    return { findings: [{ level: 'critical', title: `${input.split(':')[0]}: URL`, detail: 'Executes code or embeds content directly — a common XSS / phishing vector.' }], score: 0 };
  }
  let url;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `http://${input}`); }
  catch { throw new Error('Not a valid URL.'); }

  const rawHost = (input.match(/^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?([^/:?#]+)/i) || [])[1] || url.hostname;
  const host = url.hostname;
  const unicodeHost = hostToUnicode(host);
  const labels = host.split('.');
  const tld = labels[labels.length - 1];
  const registrable = labels.slice(-2).join('.');
  let score = 100;
  const add = (level, title, detail, penalty) => { f.push({ level, title, detail }); score -= penalty; };

  if (url.protocol === 'http:') add('medium', 'Not using HTTPS', 'Traffic can be read or modified in transit. Legit login pages always use HTTPS.', 15);
  if (url.username || url.password) add('high', 'Credentials / “@” trick in URL', `Everything before “@” is ignored by the browser — the real host is “${host}”.`, 30);
  const ip = parseIpHost(rawHost);
  if (ip) add(ip.kind.includes('encoded') || ip.kind.includes('obfuscated') ? 'high' : 'medium', `Host is an ${ip.kind}`, ip.value ? `Resolves to ${ip.value}. Encoded IPs are used to hide the destination.` : 'Legitimate sites rarely use raw IP addresses.', ip.value ? 30 : 15);
  if (unicodeHost !== host || /xn--/i.test(host)) add('high', 'Internationalized (punycode) domain', `Displays as “${unicodeHost}”. Look-alike characters can impersonate real brands (IDN homograph attack).`, 25);
  if (CONFUSABLE.test(unicodeHost)) add('high', 'Look-alike (confusable) characters', 'Contains Cyrillic/Greek letters that look like Latin ones.', 20);
  if (SUSPICIOUS_TLDS.includes(tld)) add('medium', `Frequently abused TLD (.${tld})`, 'Cheap TLDs are over-represented in phishing and malware campaigns.', 10);
  if (labels.length > 4) add('low', `Many subdomains (${labels.length - 2})`, 'Long subdomain chains like “paypal.com.secure-login.example.xyz” hide the real domain.', 10);
  if ((host.match(/-/g) || []).length >= 3) add('low', 'Many hyphens in domain', 'Common in typosquatting (e.g. secure-account-verify-login).', 5);
  const brand = BRANDS.find((b) => (host + url.pathname).toLowerCase().includes(b) && !registrable.toLowerCase().startsWith(`${b}.`));
  if (brand) add('high', `Mentions “${brand}” but the domain is ${registrable}`, 'Brand names in subdomains or paths of unrelated domains are a strong phishing signal.', 25);
  if (SHORTENERS.includes(host.replace(/^www\./, ''))) add('info', 'URL shortener', 'The final destination is hidden — expand it with a preview service before visiting.', 5);
  if (url.port && !['80', '443'].includes(url.port)) add('low', `Non-standard port :${url.port}`, null, 5);
  if (/%25[0-9a-f]{2}/i.test(input)) add('medium', 'Double URL encoding', 'Often used to evade filters.', 10);
  if (RISKY_EXT.test(url.pathname)) add('high', 'Links directly to an executable / installer', url.pathname.split('/').pop(), 25);
  if (url.pathname.includes('//')) add('low', 'Double slash in path', 'Can indicate open-redirect or path confusion tricks.', 3);
  if (input.length > 150) add('low', `Very long URL (${input.length} chars)`, 'Long URLs push the real domain out of view on mobile.', 5);
  for (const [k, v] of url.searchParams) {
    if (REDIRECT_PARAMS.includes(k.toLowerCase()) && /^(https?:)?\/\//i.test(v)) {
      let dest = v;
      try { dest = new URL(v, url).hostname; } catch {}
      if (dest !== host) add('medium', `Redirect parameter “${k}” → ${dest}`, 'Possible open redirect: a trusted domain bouncing visitors to another site.', 15);
    }
  }
  if (!f.length) f.push({ level: 'pass', title: 'No common phishing indicators found', detail: 'This is a heuristic check — it cannot tell whether the site itself is malicious.' });
  return { url, host, unicodeHost, registrable, findings: f, score: Math.max(0, score) };
}

const gradeOf = (s) => (s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 60 ? 'C' : s >= 40 ? 'D' : 'F');

export default function UrlAnalyzer() {
  const [input, setInput] = useState('http://paypal.com.account-verify.secure-login.xyz/signin?redirect=https://evil.example/');

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try { return analyze(input.trim()); } catch (e) { return { error: e.message }; }
  }, [input]);

  const params = result?.url ? [...result.url.searchParams] : [];

  return (
    <Stack gap="md">
      <Panel title="URL to analyze" icon={IconWorldSearch} actions={<>
        <Button size="compact-xs" variant="subtle" onClick={() => setInput(defang(refang(input)))}>Defang</Button>
        <Button size="compact-xs" variant="subtle" onClick={() => setInput(refang(input))}>Refang</Button>
      </>}>
        <Textarea value={input} onChange={(e) => setInput(e.currentTarget.value)} autosize minRows={2} className="code-font" spellCheck={false}
          placeholder="Paste a suspicious link (defanged hxxp://example[.]com is fine)" />
        <Text size="xs" c="dimmed" mt={4}>The URL is never opened or fetched — analysis is purely static and offline.</Text>
      </Panel>

      {result?.error && <Alert color="red">{result.error}</Alert>}

      {result && !result.error && (
        <>
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Panel title="Risk assessment" icon={result.score < 60 ? IconBiohazard : IconShieldCheck}>
              <Group mb="sm">
                <Grade grade={gradeOf(result.score)} label={result.score >= 75 ? 'Looks normal' : result.score >= 50 ? 'Suspicious — be careful' : 'Likely malicious / phishing'} />
              </Group>
              <FindingList findings={result.findings} />
            </Panel>
            {result.url && (
              <Panel title="Breakdown">
                <KVTable labelWidth={130} rows={[
                  ['Real domain', result.registrable],
                  ['Hostname', result.host],
                  result.unicodeHost !== result.host && ['Displayed as', result.unicodeHost, { color: 'red' }],
                  ['Protocol', result.url.protocol.replace(':', '')],
                  result.url.port && ['Port', result.url.port],
                  result.url.username && ['Username', decodeURIComponent(result.url.username), { color: 'red' }],
                  ['Path', decodeURIComponent(result.url.pathname)],
                  result.url.hash && ['Fragment', decodeURIComponent(result.url.hash)],
                  ['Defanged', defang(result.url.href)],
                ]} />
              </Panel>
            )}
          </SimpleGrid>
          {params.length > 0 && (
            <Panel title={`Query parameters (${params.length})`}>
              <Table striped verticalSpacing={4}>
                <Table.Thead><Table.Tr><Table.Th>Key</Table.Th><Table.Th>Decoded value</Table.Th><Table.Th w={40} /></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {params.map(([k, v], i) => (
                    <Table.Tr key={i}>
                      <Table.Td><Badge variant="light" tt="none">{k}</Badge></Table.Td>
                      <Table.Td><Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>{v}</Text></Table.Td>
                      <Table.Td><CopyButton value={v} icon /></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Panel>
          )}
        </>
      )}
      <PrivacyNote>Heuristics only — always verify the domain before entering credentials. Nothing is sent to any server.</PrivacyNote>
    </Stack>
  );
}
