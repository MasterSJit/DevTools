import { useMemo, useState } from 'react';
import { Stack, SimpleGrid, Text, Table, Badge, Group, Button, Timeline, Paper } from '@mantine/core';
import { IconServer } from '@tabler/icons-react';
import { InputArea, Panel, KVTable, FindingList, Stat, PrivacyNote } from '@/shared/components/ui';

const SAMPLE = `Delivered-To: victim@example.org
Received: by 2002:a05:6a10:1234:0:0:0:0 with SMTP id x20csp112233pxb;
        Tue, 12 Nov 2024 03:15:09 -0800 (PST)
Received: from mail.paypa1-secure.xyz (mail.paypa1-secure.xyz. [185.220.101.45])
        by mx.example.org with ESMTPS id a1si998877qkb.12.2024.11.12.03.15.07
        for <victim@example.org>;
        Tue, 12 Nov 2024 03:15:07 -0800 (PST)
Received: from [10.0.0.12] (unknown [102.89.34.11])
        by mail.paypa1-secure.xyz (Postfix) with ESMTPSA id 4F1A2B;
        Tue, 12 Nov 2024 11:13:58 +0000 (UTC)
Authentication-Results: mx.example.org;
       dkim=fail header.i=@paypal.com header.s=pp-dkim1;
       spf=softfail (domain of transitioning billing@paypa1-secure.xyz does not designate 185.220.101.45 as permitted sender) smtp.mailfrom=billing@paypa1-secure.xyz;
       dmarc=fail (p=REJECT sp=REJECT dis=NONE) header.from=paypal.com
Return-Path: <billing@paypa1-secure.xyz>
From: "PayPal Security <service@paypal.com>" <service@paypal.com>
Reply-To: support-desk@protonmail-help.ru
To: victim@example.org
Subject: Your account has been limited
Date: Tue, 12 Nov 2024 11:13:57 +0000
Message-ID: <20241112111357.4F1A2B@mail.paypa1-secure.xyz>
X-Mailer: PHPMailer 5.2.1
X-Originating-IP: [102.89.34.11]
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8`;

export function parseHeaders(raw) {
  const text = raw.replace(/\r\n/g, '\n').split(/\n\n/)[0];
  const unfolded = text.replace(/\n[ \t]+/g, ' ');
  const list = [];
  unfolded.split('\n').forEach((line) => {
    const i = line.indexOf(':');
    if (i > 0 && /^[!-9;-~]+$/.test(line.slice(0, i))) list.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  });
  return list;
}

const get = (h, name) => h.find(([k]) => k.toLowerCase() === name)?.[1] || '';
const getAll = (h, name) => h.filter(([k]) => k.toLowerCase() === name).map(([, v]) => v);
const addrOf = (v) => (v.match(/<([^>]+)>\s*$/)?.[1] || v.match(/[\w.+-]+@[\w.-]+/)?.[0] || '').toLowerCase();
const domainOf = (a) => a.split('@')[1] || '';
const orgDomain = (d) => d.split('.').slice(-2).join('.');
const isPrivate = (ip) => /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|fc|fd)/i.test(ip);

function parseReceived(v) {
  const from = v.match(/from\s+(\S+)(?:\s+\(([^)]*)\))?/i);
  const by = v.match(/by\s+(\S+)/i);
  const ip = v.match(/\[((?:\d{1,3}\.){3}\d{1,3}|[0-9a-f:]{3,})\]/i)?.[1] || '';
  const date = v.split(';').pop().trim();
  const t = Date.parse(date.replace(/\s*\([^)]*\)\s*$/, ''));
  const tls = /ESMTPS|ESMTPSA|TLS/i.test(v);
  return { from: from?.[1] || '', fromInfo: from?.[2] || '', by: by?.[1] || '', ip, date, t: Number.isNaN(t) ? null : t, tls, raw: v };
}

function authResults(h) {
  const all = getAll(h, 'authentication-results').join('; ');
  const pick = (m) => all.match(new RegExp(`\\b${m}=(\\w+)`, 'i'))?.[1]?.toLowerCase() || null;
  return { spf: pick('spf') || (get(h, 'received-spf').split(/\s/)[0] || '').toLowerCase() || null, dkim: pick('dkim'), dmarc: pick('dmarc'), arc: pick('arc'), raw: all };
}

const fmtDelay = (ms) => (ms == null ? '' : ms < 0 ? `${Math.round(ms / 1000)}s (clock skew)` : ms < 60000 ? `${Math.round(ms / 1000)}s` : ms < 3600000 ? `${Math.round(ms / 60000)} min` : `${(ms / 3600000).toFixed(1)} h`);
const AUTH_COLOR = { pass: 'teal', fail: 'red', softfail: 'orange', neutral: 'gray', none: 'gray', temperror: 'yellow', permerror: 'red' };

export default function EmailHeaderAnalyzer() {
  const [raw, setRaw] = useState(SAMPLE);

  const a = useMemo(() => {
    const h = parseHeaders(raw);
    if (!h.length) return null;
    const hops = getAll(h, 'received').map(parseReceived).reverse(); // oldest first
    hops.forEach((x, i) => { x.delay = i && x.t && hops[i - 1].t ? x.t - hops[i - 1].t : null; });
    const from = get(h, 'from'); const fromAddr = addrOf(from);
    const returnPath = addrOf(get(h, 'return-path')); const replyTo = addrOf(get(h, 'reply-to'));
    const auth = authResults(h);
    const display = from.replace(/<[^>]*>\s*$/, '').replace(/"/g, '').trim();
    const f = [];
    if (auth.spf && auth.spf !== 'pass') f.push({ level: auth.spf === 'fail' ? 'high' : 'medium', title: `SPF ${auth.spf}`, detail: 'The sending server is not authorised by the envelope-sender domain.' });
    if (auth.dkim && auth.dkim !== 'pass') f.push({ level: 'high', title: `DKIM ${auth.dkim}`, detail: 'The signature is missing or does not match — the message may have been forged or altered.' });
    if (auth.dmarc && auth.dmarc !== 'pass') f.push({ level: 'critical', title: `DMARC ${auth.dmarc}`, detail: 'The visible From domain failed alignment. Classic sign of spoofing.' });
    if (!auth.raw) f.push({ level: 'info', title: 'No Authentication-Results header', detail: 'Copy the headers from the receiving mailbox (Gmail: “Show original”; Outlook: “View message source”).' });
    if (fromAddr && returnPath && orgDomain(domainOf(fromAddr)) !== orgDomain(domainOf(returnPath))) f.push({ level: 'medium', title: 'From and Return-Path domains differ', detail: `${domainOf(fromAddr)} vs ${domainOf(returnPath)} — normal for newsletters, suspicious for banks or colleagues.` });
    if (replyTo && fromAddr && orgDomain(domainOf(replyTo)) !== orgDomain(domainOf(fromAddr))) f.push({ level: 'high', title: 'Reply-To points to a different domain', detail: `Replies go to ${replyTo}, not ${fromAddr}. Common in invoice / CEO fraud.` });
    const dispEmail = display.match(/[\w.+-]+@[\w.-]+/)?.[0];
    if (dispEmail && dispEmail.toLowerCase() !== fromAddr) f.push({ level: 'high', title: 'Display name contains a different email address', detail: `Shows “${dispEmail}” but the real sender is ${fromAddr}.` });
    if (/[а-яё]|xn--/i.test(from)) f.push({ level: 'high', title: 'Look-alike characters in From', detail: 'Cyrillic letters or punycode can imitate a real domain.' });
    const mailer = get(h, 'x-mailer');
    if (/phpmailer|swiftmailer|sendblaster|mass mailer/i.test(mailer)) f.push({ level: 'low', title: `Bulk mailer: ${mailer}`, detail: 'Often used by phishing kits (also by legitimate sites).' });
    const msgId = get(h, 'message-id');
    if (msgId && fromAddr && !msgId.toLowerCase().includes(orgDomain(domainOf(fromAddr)))) f.push({ level: 'low', title: 'Message-ID domain differs from From domain', detail: msgId });
    const slow = hops.filter((x) => x.delay > 3600000);
    if (slow.length) f.push({ level: 'info', title: `${slow.length} hop(s) delayed more than 1 hour`, detail: 'Could be greylisting, queueing, or a forged Received line.' });
    if (hops.some((x) => !x.tls && x.from)) f.push({ level: 'info', title: 'Some hops did not use TLS' });
    if (!f.some((x) => ['critical', 'high', 'medium'].includes(x.level))) f.unshift({ level: 'pass', title: 'No strong spoofing indicators' });
    const originIp = get(h, 'x-originating-ip').replace(/[[\]]/g, '') || hops.map((x) => x.ip).find((ip) => ip && !isPrivate(ip)) || '';
    return { h, hops, from, fromAddr, returnPath, replyTo, auth, findings: f, originIp, subject: get(h, 'subject'), date: get(h, 'date'), to: get(h, 'to') };
  }, [raw]);

  const total = a?.hops.length > 1 && a.hops[0].t && a.hops[a.hops.length - 1].t ? a.hops[a.hops.length - 1].t - a.hops[0].t : null;

  return (
    <Stack gap="md">
      <InputArea label="Raw email headers" value={raw} onChange={setRaw} minRows={8} maxRows={16}
        actions={<Button size="compact-xs" variant="subtle" onClick={() => setRaw(SAMPLE)}>Phishing sample</Button>} />
      {a && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            {['spf', 'dkim', 'dmarc'].map((k) => (
              <Paper key={k} p="sm">
                <Text size="xs" c="dimmed" fw={500}>{k.toUpperCase()}</Text>
                <Badge size="lg" mt={4} variant="light" color={AUTH_COLOR[a.auth[k]] || 'gray'}>{a.auth[k] || 'not found'}</Badge>
              </Paper>
            ))}
            <Stat label="Total delivery time" value={fmtDelay(total) || '—'} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Panel title="Verdict"><FindingList findings={a.findings} /></Panel>
            <Panel title="Summary">
              <KVTable labelWidth={120} rows={[
                ['Subject', a.subject], ['From', a.from], ['Return-Path', a.returnPath || '—'], ['Reply-To', a.replyTo || '—'],
                ['To', a.to], ['Date', a.date], ['Origin IP', a.originIp || '—'],
              ]} />
            </Panel>
          </SimpleGrid>
          <Panel title={`Delivery path (${a.hops.length} hops, oldest first)`}>
            {a.hops.length ? (
              <Timeline bulletSize={22} lineWidth={2} active={a.hops.length}>
                {a.hops.map((x, i) => (
                  <Timeline.Item key={i} bullet={<IconServer size={12} />} title={
                    <Group gap={6} wrap="wrap"><Text size="sm" fw={600} ff="monospace">{x.from || '(local)'}</Text><Text size="xs" c="dimmed">→ {x.by}</Text>
                      {x.ip && <Badge size="xs" variant="light" color={isPrivate(x.ip) ? 'gray' : 'grape'}>{x.ip}</Badge>}
                      {x.tls && <Badge size="xs" variant="light" color="teal">TLS</Badge>}
                      {x.delay != null && <Badge size="xs" variant="outline" color={x.delay > 3600000 ? 'orange' : 'gray'}>+{fmtDelay(x.delay)}</Badge>}
                    </Group>}>
                    <Text size="xs" c="dimmed">{x.date}</Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : <Text size="sm" c="dimmed">No Received headers.</Text>}
          </Panel>
          <Panel title={`All headers (${a.h.length})`}>
            <Table.ScrollContainer minWidth={500}>
              <Table fz="xs" striped verticalSpacing={4}>
                <Table.Tbody>{a.h.map(([k, v], i) => <Table.Tr key={i}><Table.Td w={200} ff="monospace" fw={600}>{k}</Table.Td><Table.Td style={{ wordBreak: 'break-all' }}>{v}</Table.Td></Table.Tr>)}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Panel>
        </>
      )}
      <PrivacyNote>Headers are parsed locally — safe for real incident mail. No DNS lookups are made.</PrivacyNote>
    </Stack>
  );
}
