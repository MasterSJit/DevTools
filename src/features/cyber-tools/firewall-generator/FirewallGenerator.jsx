import { useMemo, useState } from 'react';
import { Stack, SimpleGrid, Table, TextInput, Select, Switch, Button, ActionIcon, Group, Text, SegmentedControl, Textarea, Alert, Chip } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Panel, OutputArea, PrivacyNote } from '@/shared/components/ui';

const PRESET_SERVICES = {
  SSH: { port: '22', proto: 'tcp' }, HTTP: { port: '80', proto: 'tcp' }, HTTPS: { port: '443', proto: 'tcp' },
  'HTTP/3': { port: '443', proto: 'udp' }, DNS: { port: '53', proto: 'both' }, SMTP: { port: '25', proto: 'tcp' },
  Submission: { port: '587', proto: 'tcp' }, IMAPS: { port: '993', proto: 'tcp' }, WireGuard: { port: '51820', proto: 'udp' },
  OpenVPN: { port: '1194', proto: 'udp' }, MySQL: { port: '3306', proto: 'tcp' }, PostgreSQL: { port: '5432', proto: 'tcp' },
};

const IPV4 = /^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)(\/(3[0-2]|[12]?\d))?$/;
const IPV6 = /^[0-9a-f:]+(\/(12[0-8]|1[01]\d|\d?\d))?$/i;
const validSrc = (s) => !s || s === 'any' || IPV4.test(s) || (s.includes(':') && IPV6.test(s));
const validPort = (p) => /^\d{1,5}(:\d{1,5})?$/.test(p) && p.split(':').every((x) => +x >= 1 && +x <= 65535);
const isV6 = (s) => s.includes(':');

export default function FirewallGenerator() {
  const [rules, setRules] = useState([
    { name: 'SSH (office only)', port: '22', proto: 'tcp', src: '203.0.113.0/24' },
    { name: 'HTTP', port: '80', proto: 'tcp', src: 'any' },
    { name: 'HTTPS', port: '443', proto: 'tcp', src: 'any' },
  ]);
  const [rateSsh, setRateSsh] = useState(true);
  const [icmp, setIcmp] = useState(true);
  const [logDrops, setLogDrops] = useState(false);
  const [ipv6, setIpv6] = useState(true);
  const [blocked, setBlocked] = useState('198.51.100.23\n185.220.101.0/24');
  const [target, setTarget] = useState('ufw');

  const setRule = (i, p) => setRules((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const blockList = blocked.split(/[\s,]+/).filter(Boolean);
  const errors = [
    ...rules.flatMap((r, i) => [!validPort(r.port) && `Rule ${i + 1}: invalid port “${r.port}”`, !validSrc(r.src) && `Rule ${i + 1}: invalid source “${r.src}”`]),
    ...blockList.filter((b) => !validSrc(b)).map((b) => `Invalid block entry “${b}”`),
  ].filter(Boolean);
  const sshExposed = rules.some((r) => r.port === '22' && (!r.src || r.src === 'any'));

  const out = useMemo(() => {
    if (errors.length) return '# Fix the errors above first';
    const protos = (p) => (p === 'both' ? ['tcp', 'udp'] : [p]);
    const anySrc = (s) => !s || s === 'any';
    const comment = (r) => r.name.replace(/[^\w ()./-]/g, '').slice(0, 60);

    if (target === 'ufw') {
      const L = ['# UFW — run as root', 'ufw --force reset', 'ufw default deny incoming', 'ufw default allow outgoing'];
      if (!ipv6) L.push("sed -i 's/^IPV6=.*/IPV6=no/' /etc/default/ufw");
      blockList.forEach((b) => L.push(`ufw deny from ${b} comment 'blocklist'`));
      rules.forEach((r) => protos(r.proto).forEach((p) => {
        const verb = r.port === '22' && rateSsh ? 'limit' : 'allow';
        L.push(anySrc(r.src) ? `ufw ${verb} ${r.port}/${p} comment '${comment(r)}'` : `ufw ${verb} from ${r.src} to any port ${r.port} proto ${p} comment '${comment(r)}'`);
      }));
      if (logDrops) L.push('ufw logging medium');
      L.push('ufw --force enable', 'ufw status verbose');
      return L.join('\n');
    }

    if (target === 'iptables') {
      const gen = (v6) => {
        const cmd = v6 ? 'ip6tables' : 'iptables';
        const L = [`# ${cmd}`, `${cmd} -F`, `${cmd} -X`, `${cmd} -P INPUT DROP`, `${cmd} -P FORWARD DROP`, `${cmd} -P OUTPUT ACCEPT`,
          `${cmd} -A INPUT -i lo -j ACCEPT`, `${cmd} -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`, `${cmd} -A INPUT -m conntrack --ctstate INVALID -j DROP`];
        blockList.filter((b) => isV6(b) === v6).forEach((b) => L.push(`${cmd} -A INPUT -s ${b} -j DROP`));
        if (icmp) L.push(v6 ? `${cmd} -A INPUT -p ipv6-icmp -j ACCEPT` : `${cmd} -A INPUT -p icmp --icmp-type echo-request -m limit --limit 5/s -j ACCEPT`);
        rules.forEach((r) => {
          if (!anySrc(r.src) && isV6(r.src) !== v6) return;
          protos(r.proto).forEach((p) => {
            const src = anySrc(r.src) ? '' : ` -s ${r.src}`;
            const dport = ` --dport ${r.port}`;
            if (r.port === '22' && rateSsh) {
              L.push(`${cmd} -A INPUT -p ${p}${src}${dport} -m conntrack --ctstate NEW -m recent --set --name SSH`);
              L.push(`${cmd} -A INPUT -p ${p}${src}${dport} -m conntrack --ctstate NEW -m recent --update --seconds 60 --hitcount 6 --name SSH -j DROP`);
            }
            L.push(`${cmd} -A INPUT -p ${p}${src}${dport} -m conntrack --ctstate NEW -m comment --comment "${comment(r)}" -j ACCEPT`);
          });
        });
        if (logDrops) L.push(`${cmd} -A INPUT -m limit --limit 5/min -j LOG --log-prefix "${cmd}-drop: "`);
        return L.join('\n');
      };
      return [gen(false), ipv6 && gen(true), '# Persist: apt install iptables-persistent && netfilter-persistent save'].filter(Boolean).join('\n\n');
    }

    // nftables
    const set4 = blockList.filter((b) => !isV6(b)); const set6 = blockList.filter(isV6);
    const L = ['#!/usr/sbin/nft -f', 'flush ruleset', '', 'table inet filter {'];
    if (set4.length) L.push(`  set blocklist4 { type ipv4_addr; flags interval; elements = { ${set4.join(', ')} } }`);
    if (set6.length) L.push(`  set blocklist6 { type ipv6_addr; flags interval; elements = { ${set6.join(', ')} } }`);
    L.push('  chain input {', '    type filter hook input priority 0; policy drop;', '    iif lo accept', '    ct state established,related accept', '    ct state invalid drop');
    if (set4.length) L.push('    ip saddr @blocklist4 drop');
    if (set6.length) L.push('    ip6 saddr @blocklist6 drop');
    if (!ipv6) L.push('    meta nfproto ipv6 drop');
    if (icmp) L.push('    ip protocol icmp icmp type echo-request limit rate 5/second accept', '    ip6 nexthdr icmpv6 accept');
    rules.forEach((r) => protos(r.proto).forEach((p) => {
      const src = anySrc(r.src) ? '' : `${isV6(r.src) ? 'ip6' : 'ip'} saddr ${r.src} `;
      const port = r.port.replace(':', '-');
      const limit = r.port === '22' && rateSsh ? 'ct state new limit rate 6/minute ' : '';
      L.push(`    ${src}${p} dport ${port} ${limit}accept comment "${comment(r)}"`);
    }));
    if (logDrops) L.push('    limit rate 5/minute log prefix "nft-drop: "');
    L.push('  }', '  chain forward { type filter hook forward priority 0; policy drop; }', '  chain output { type filter hook output priority 0; policy accept; }', '}');
    return L.join('\n');
  }, [rules, rateSsh, icmp, logDrops, ipv6, blocked, target, errors.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Stack gap="md">
      <Alert variant="light" color="yellow" p="xs">
        <Text size="xs">Default-deny inbound. <b>Keep an SSH session open while applying</b> and make sure your own IP is allowed, or you can lock yourself out.</Text>
      </Alert>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Stack gap="md">
          <Panel title="Allowed inbound services">
            <Chip.Group>
              <Group gap={4} mb="sm">
                {Object.entries(PRESET_SERVICES).map(([n, s]) => (
                  <Chip key={n} size="xs" checked={false} onClick={() => setRules((r) => [...r, { name: n, ...s, src: 'any' }])}>+ {n}</Chip>
                ))}
              </Group>
            </Chip.Group>
            <Table.ScrollContainer minWidth={480}>
              <Table verticalSpacing={4}>
                <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Port</Table.Th><Table.Th>Proto</Table.Th><Table.Th>Source (CIDR or any)</Table.Th><Table.Th /></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {rules.map((r, i) => (
                    <Table.Tr key={i}>
                      <Table.Td><TextInput size="xs" value={r.name} onChange={(e) => setRule(i, { name: e.currentTarget.value })} /></Table.Td>
                      <Table.Td w={90}><TextInput size="xs" value={r.port} error={!validPort(r.port)} placeholder="443 or 8000:8100" onChange={(e) => setRule(i, { port: e.currentTarget.value.trim() })} /></Table.Td>
                      <Table.Td w={90}><Select size="xs" value={r.proto} allowDeselect={false} data={['tcp', 'udp', 'both']} onChange={(v) => setRule(i, { proto: v })} /></Table.Td>
                      <Table.Td><TextInput size="xs" value={r.src} error={!validSrc(r.src)} onChange={(e) => setRule(i, { src: e.currentTarget.value.trim() })} /></Table.Td>
                      <Table.Td w={36}><ActionIcon variant="subtle" color="red" size="sm" aria-label="Remove rule" onClick={() => setRules((x) => x.filter((_, j) => j !== i))}><IconTrash size={14} /></ActionIcon></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            <Button mt="xs" size="xs" variant="default" leftSection={<IconPlus size={14} />} onClick={() => setRules((r) => [...r, { name: 'Custom', port: '8080', proto: 'tcp', src: 'any' }])}>Add rule</Button>
          </Panel>
          <Panel title="Options">
            <Stack gap="xs">
              <Switch size="sm" label="Rate-limit new SSH connections (anti brute-force)" checked={rateSsh} onChange={(e) => setRateSsh(e.currentTarget.checked)} />
              <Switch size="sm" label="Allow ping (ICMP, rate-limited)" checked={icmp} onChange={(e) => setIcmp(e.currentTarget.checked)} />
              <Switch size="sm" label="Log dropped packets" checked={logDrops} onChange={(e) => setLogDrops(e.currentTarget.checked)} />
              <Switch size="sm" label="IPv6 rules" checked={ipv6} onChange={(e) => setIpv6(e.currentTarget.checked)} />
              <Textarea label="Block these IPs / CIDRs" value={blocked} onChange={(e) => setBlocked(e.currentTarget.value)} autosize minRows={2} className="code-font" />
            </Stack>
          </Panel>
        </Stack>
        <Stack gap="md">
          <SegmentedControl value={target} onChange={setTarget} data={[{ value: 'ufw', label: 'UFW' }, { value: 'iptables', label: 'iptables' }, { value: 'nftables', label: 'nftables' }]} />
          {errors.length > 0 && <Alert color="red" variant="light" p="xs">{errors.map((e) => <div key={e}>{e}</div>)}</Alert>}
          {sshExposed && <Alert color="orange" variant="light" p="xs"><Text size="xs">SSH is open to the whole internet. Restrict the source to your IP / VPN range if you can.</Text></Alert>}
          <OutputArea label={`${target} script`} value={out} minRows={20} maxRows={40} filename={target === 'nftables' ? 'nftables.conf' : `${target}-rules.sh`} />
        </Stack>
      </SimpleGrid>
      <PrivacyNote />
    </Stack>
  );
}
