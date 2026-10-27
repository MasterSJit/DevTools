import { useMemo, useState } from 'react';
import { Stack, Group, Text, TextInput, Tabs, SimpleGrid, Badge, Table, Select, Alert, ScrollArea } from '@mantine/core';
import { IconNetwork } from '@tabler/icons-react';
import { Panel, KVTable } from '@/shared/components/ui';
import { ipToInt, intToIp, maskFromPrefix, parseIPv6 as parseV6 } from '@/shared/lib/ip';

// ── IPv4 ──
const toBin = (n) => [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, '0')).join('.');

const RANGES = [
  ['10.0.0.0/8', 'Private (RFC 1918)'], ['172.16.0.0/12', 'Private (RFC 1918)'], ['192.168.0.0/16', 'Private (RFC 1918)'],
  ['127.0.0.0/8', 'Loopback'], ['169.254.0.0/16', 'Link-local (APIPA)'], ['100.64.0.0/10', 'Carrier-grade NAT (RFC 6598)'],
  ['224.0.0.0/4', 'Multicast'], ['240.0.0.0/4', 'Reserved'], ['0.0.0.0/8', '“This” network'],
  ['192.0.2.0/24', 'Documentation (TEST-NET-1)'], ['198.51.100.0/24', 'Documentation (TEST-NET-2)'], ['203.0.113.0/24', 'Documentation (TEST-NET-3)'],
  ['198.18.0.0/15', 'Benchmarking'], ['255.255.255.255/32', 'Broadcast'],
];

function classify(n) {
  for (const [cidr, label] of RANGES) {
    const [base, p] = cidr.split('/');
    const m = maskFromPrefix(Number(p));
    if (((n & m) >>> 0) === ((ipToInt(base) & m) >>> 0)) return label;
  }
  return 'Public';
}

function parseV4(input) {
  const s = input.trim();
  let ip, prefix;
  const m = s.match(/^([\d.]+)\s*(?:\/\s*(\d{1,2})|\s+([\d.]+))?$/);
  if (!m) throw new Error('Use a.b.c.d/prefix or a.b.c.d 255.255.255.0');
  ip = ipToInt(m[1]);
  if (m[2] !== undefined) prefix = Number(m[2]);
  else if (m[3]) {
    const mask = ipToInt(m[3]);
    const bits = mask.toString(2).padStart(32, '0');
    if (!/^1*0*$/.test(bits)) throw new Error('Netmask must be contiguous ones followed by zeros');
    prefix = bits.indexOf('0') === -1 ? 32 : bits.indexOf('0');
  } else prefix = 32;
  if (prefix > 32) throw new Error('Prefix must be 0–32');
  const mask = maskFromPrefix(prefix);
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  const usable = prefix >= 31 ? total : total - 2;
  return {
    ip, prefix, mask, network, broadcast, total, usable,
    first: prefix >= 31 ? network : network + 1,
    last: prefix >= 31 ? broadcast : broadcast - 1,
    cls: (ip >>> 24) < 128 ? 'A' : (ip >>> 24) < 192 ? 'B' : (ip >>> 24) < 224 ? 'C' : (ip >>> 24) < 240 ? 'D (multicast)' : 'E',
  };
}

function Ipv4() {
  const [input, setInput] = useState('192.168.10.37/26');
  const [split, setSplit] = useState(null);
  const [check, setCheck] = useState('192.168.10.50');

  const r = useMemo(() => { try { return parseV4(input); } catch (e) { return { error: e.message }; } }, [input]);

  const subnets = useMemo(() => {
    if (!r || r.error || !split) return [];
    const p = Number(split);
    if (p <= r.prefix) return [];
    const count = Math.min(2 ** (p - r.prefix), 1024);
    const size = 2 ** (32 - p);
    return Array.from({ length: count }, (_, i) => {
      const net = r.network + i * size;
      return { net: `${intToIp(net)}/${p}`, range: p >= 31 ? `${intToIp(net)} – ${intToIp(net + size - 1)}` : `${intToIp(net + 1)} – ${intToIp(net + size - 2)}`, bc: intToIp(net + size - 1) };
    });
  }, [r, split]);

  let inRange = null;
  try { if (r && !r.error && check.trim()) inRange = ((ipToInt(check.trim()) & r.mask) >>> 0) === r.network; } catch { inRange = 'invalid'; }

  return (
    <Stack gap="md">
      <TextInput size="md" label="IPv4 address with CIDR prefix or netmask" value={input} onChange={(e) => setInput(e.currentTarget.value)}
        className="code-font" placeholder="10.0.0.0/8 or 192.168.1.1 255.255.255.0" leftSection={<IconNetwork size={16} />} />
      {r?.error && <Alert color="red" p="xs">{r.error}</Alert>}
      {r && !r.error && (
        <>
          <Group gap="xs">
            <Badge size="lg" variant="light">{classify(r.ip)}</Badge>
            <Badge size="lg" variant="light" color="gray">Class {r.cls}</Badge>
            <Badge size="lg" variant="light" color="teal">{r.usable.toLocaleString()} usable hosts</Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Panel title="Network">
              <KVTable labelWidth={150} rows={[
                ['Network address', `${intToIp(r.network)}/${r.prefix}`],
                ['Netmask', intToIp(r.mask)],
                ['Wildcard (ACL) mask', intToIp(~r.mask >>> 0)],
                ['Broadcast', intToIp(r.broadcast)],
                ['First usable host', intToIp(r.first)],
                ['Last usable host', intToIp(r.last)],
                ['Total addresses', r.total.toLocaleString()],
              ]} />
            </Panel>
            <Panel title="Representations">
              <KVTable labelWidth={150} rows={[
                ['IP (binary)', toBin(r.ip)],
                ['Mask (binary)', toBin(r.mask)],
                ['IP (decimal integer)', String(r.ip)],
                ['IP (hex)', `0x${r.ip.toString(16).padStart(8, '0')}`],
                ['Reverse DNS zone', `${intToIp(r.network).split('.').slice(0, Math.max(1, Math.floor(r.prefix / 8))).reverse().join('.')}.in-addr.arpa`],
                ['IPv4-mapped IPv6', `::ffff:${intToIp(r.ip)}`],
              ]} />
            </Panel>
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Panel title="Is an IP inside this network?">
              <Group>
                <TextInput value={check} onChange={(e) => setCheck(e.currentTarget.value)} className="code-font" w={200} />
                {inRange === true && <Badge color="teal" size="lg">Inside</Badge>}
                {inRange === false && <Badge color="red" size="lg">Outside</Badge>}
                {inRange === 'invalid' && <Badge color="orange" size="lg">Invalid IP</Badge>}
              </Group>
            </Panel>
            <Panel title="Split into subnets">
              <Select placeholder="Choose a longer prefix" value={split} onChange={setSplit} clearable w={240}
                data={Array.from({ length: Math.max(0, Math.min(32, r.prefix + 10) - r.prefix) }, (_, i) => {
                  const p = r.prefix + i + 1;
                  return { value: String(p), label: `/${p} → ${(2 ** (p - r.prefix)).toLocaleString()} subnets of ${(2 ** (32 - p)).toLocaleString()}` };
                })} />
            </Panel>
          </SimpleGrid>
          {subnets.length > 0 && (
            <Panel title={`${subnets.length} subnets${subnets.length === 1024 ? ' (first 1024)' : ''}`}>
              <ScrollArea.Autosize mah={380}>
                <Table striped verticalSpacing={3}>
                  <Table.Thead><Table.Tr><Table.Th>Subnet</Table.Th><Table.Th>Usable range</Table.Th><Table.Th>Broadcast</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {subnets.map((s) => (
                      <Table.Tr key={s.net}><Table.Td ff="monospace" fz="xs">{s.net}</Table.Td><Table.Td ff="monospace" fz="xs">{s.range}</Table.Td><Table.Td ff="monospace" fz="xs">{s.bc}</Table.Td></Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea.Autosize>
            </Panel>
          )}
        </>
      )}
    </Stack>
  );
}

// ── IPv6 ──
const v6Groups = (n) => Array.from({ length: 8 }, (_, i) => Number((n >> BigInt((7 - i) * 16)) & 0xffffn).toString(16));
const v6Expanded = (n) => v6Groups(n).map((g) => g.padStart(4, '0')).join(':');

function v6Compressed(n) {
  const g = v6Groups(n);
  let best = [-1, 0], cur = [-1, 0];
  g.forEach((x, i) => {
    if (x === '0') { if (cur[0] < 0) cur = [i, 1]; else cur[1]++; if (cur[1] > best[1]) best = [...cur]; }
    else cur = [-1, 0];
  });
  if (best[1] < 2) return g.join(':');
  return `${g.slice(0, best[0]).join(':')}::${g.slice(best[0] + best[1]).join(':')}`;
}

function classifyV6(n) {
  const top = n >> 112n;
  if (n === 1n) return 'Loopback (::1)';
  if (n === 0n) return 'Unspecified (::)';
  if ((n >> 32n) === 0xffffn) return 'IPv4-mapped';
  if ((top & 0xffc0n) === 0xfe80n) return 'Link-local (fe80::/10)';
  if ((top & 0xfe00n) === 0xfc00n) return 'Unique local (fc00::/7, private)';
  if ((top & 0xff00n) === 0xff00n) return 'Multicast (ff00::/8)';
  if (top === 0x2001n && ((n >> 96n) & 0xffffn) === 0x0db8n) return 'Documentation (2001:db8::/32)';
  if ((top & 0xe000n) === 0x2000n) return 'Global unicast';
  return 'Reserved / other';
}

function Ipv6() {
  const [input, setInput] = useState('2001:db8:85a3::8a2e:370:7334/64');
  const r = useMemo(() => {
    try {
      const [addr, p = '128'] = input.trim().split('/');
      const prefix = Number(p);
      if (!(prefix >= 0 && prefix <= 128)) throw new Error('Prefix must be 0–128');
      const n = parseV6(addr);
      const hostBits = BigInt(128 - prefix);
      const mask = ((1n << 128n) - 1n) ^ ((1n << hostBits) - 1n);
      const net = n & mask;
      const last = net | ((1n << hostBits) - 1n);
      return { n, prefix, net, last, count: 1n << hostBits };
    } catch (e) { return { error: e.message }; }
  }, [input]);

  return (
    <Stack gap="md">
      <TextInput size="md" label="IPv6 address (optionally with /prefix)" value={input} onChange={(e) => setInput(e.currentTarget.value)} className="code-font" />
      {r.error && <Alert color="red" p="xs">{r.error}</Alert>}
      {!r.error && (
        <Panel title={classifyV6(r.n)}>
          <KVTable labelWidth={160} rows={[
            ['Compressed', v6Compressed(r.n)],
            ['Expanded', v6Expanded(r.n)],
            ['Network', `${v6Compressed(r.net)}/${r.prefix}`],
            ['First address', v6Expanded(r.net)],
            ['Last address', v6Expanded(r.last)],
            ['Addresses in prefix', r.count > 10n ** 15n ? `2^${128 - r.prefix}` : r.count.toLocaleString()],
            r.prefix === 64 && ['/64 subnets in a /48', '65,536'],
          ]} />
        </Panel>
      )}
    </Stack>
  );
}

export default function SubnetCalculator() {
  const [tab, setTab] = useState('v4');
  return (
    <Stack gap="md">
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="v4">IPv4</Tabs.Tab>
          <Tabs.Tab value="v6">IPv6</Tabs.Tab>
        </Tabs.List>
      </Tabs>
      {tab === 'v4' ? <Ipv4 /> : <Ipv6 />}
      <Text size="xs" c="dimmed">Pure calculation — no network requests.</Text>
    </Stack>
  );
}
