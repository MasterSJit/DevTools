import { useMemo, useState } from 'react';
import { Stack, TextInput, Table, Badge, Text, Group, Chip } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { PrivacyNote } from '@/shared/components/ui';

// [port, proto, service, risk, note] — risk reflects exposure to the internet.
const PORTS = [
  [20, 'tcp', 'FTP data', 'high', 'Cleartext. Replace FTP with SFTP/FTPS.'],
  [21, 'tcp', 'FTP control', 'high', 'Cleartext credentials; check for anonymous login.'],
  [22, 'tcp', 'SSH', 'medium', 'Use keys only, disable root login and password auth.'],
  [23, 'tcp', 'Telnet', 'critical', 'Cleartext remote shell — should never be exposed.'],
  [25, 'tcp', 'SMTP', 'medium', 'Check for open relay; require STARTTLS.'],
  [53, 'tcp/udp', 'DNS', 'medium', 'Open resolvers are abused for amplification; restrict recursion and AXFR.'],
  [67, 'udp', 'DHCP server', 'low', 'LAN only.'],
  [69, 'udp', 'TFTP', 'high', 'No authentication — often leaks device configs.'],
  [80, 'tcp', 'HTTP', 'low', 'Redirect to HTTPS and enable HSTS.'],
  [88, 'tcp/udp', 'Kerberos', 'medium', 'Active Directory; never expose to the internet.'],
  [110, 'tcp', 'POP3', 'medium', 'Cleartext; use 995.'],
  [111, 'tcp/udp', 'RPCbind', 'high', 'Leaks RPC services (NFS); amplification vector.'],
  [123, 'udp', 'NTP', 'medium', 'Disable monlist; amplification vector.'],
  [135, 'tcp', 'MS RPC', 'high', 'Windows RPC endpoint mapper — internal only.'],
  [137, 'udp', 'NetBIOS name', 'high', 'Leaks host / domain names.'],
  [139, 'tcp', 'NetBIOS session', 'high', 'Legacy SMB — internal only.'],
  [143, 'tcp', 'IMAP', 'medium', 'Cleartext; use 993.'],
  [161, 'udp', 'SNMP', 'high', 'Default “public” community strings leak full device info; use SNMPv3.'],
  [389, 'tcp/udp', 'LDAP', 'high', 'Check anonymous bind; use LDAPS (636). CLDAP amplification.'],
  [443, 'tcp', 'HTTPS', 'low', 'Check TLS config and certificate.'],
  [445, 'tcp', 'SMB', 'critical', 'EternalBlue / ransomware worms — never expose to the internet.'],
  [465, 'tcp', 'SMTPS', 'low', 'Implicit-TLS mail submission.'],
  [500, 'udp', 'IKE (IPsec VPN)', 'medium', 'Check for aggressive mode.'],
  [514, 'udp', 'Syslog', 'medium', 'Cleartext logs.'],
  [587, 'tcp', 'SMTP submission', 'low', 'Require auth + STARTTLS.'],
  [636, 'tcp', 'LDAPS', 'medium', 'Directory — internal only.'],
  [873, 'tcp', 'rsync', 'high', 'Check for unauthenticated modules.'],
  [993, 'tcp', 'IMAPS', 'low', ''],
  [995, 'tcp', 'POP3S', 'low', ''],
  [1080, 'tcp', 'SOCKS proxy', 'high', 'Open proxies get abused.'],
  [1194, 'udp', 'OpenVPN', 'low', ''],
  [1433, 'tcp', 'MS SQL Server', 'critical', 'Database — never expose; brute-forced constantly.'],
  [1521, 'tcp', 'Oracle DB', 'critical', 'Database — never expose.'],
  [1723, 'tcp', 'PPTP VPN', 'high', 'Broken crypto (MS-CHAPv2); migrate to WireGuard / IPsec.'],
  [1883, 'tcp', 'MQTT', 'high', 'IoT broker; often unauthenticated.'],
  [2049, 'tcp/udp', 'NFS', 'high', 'Check exports for world-readable shares.'],
  [2375, 'tcp', 'Docker API (no TLS)', 'critical', 'Unauthenticated root on the host — cryptominer favourite.'],
  [2376, 'tcp', 'Docker API (TLS)', 'medium', 'Require client certificates.'],
  [2379, 'tcp', 'etcd', 'critical', 'Holds Kubernetes secrets.'],
  [3000, 'tcp', 'Dev servers / Grafana', 'medium', 'Check for default admin:admin.'],
  [3128, 'tcp', 'Squid proxy', 'medium', ''],
  [3306, 'tcp', 'MySQL / MariaDB', 'critical', 'Database — bind to localhost.'],
  [3389, 'tcp', 'RDP', 'critical', 'BlueKeep, brute force; put behind VPN with NLA.'],
  [4444, 'tcp', 'Metasploit default', 'high', 'Unexpected listener may indicate compromise.'],
  [5000, 'tcp', 'Flask / Docker registry / UPnP', 'medium', ''],
  [5432, 'tcp', 'PostgreSQL', 'critical', 'Database — bind to localhost.'],
  [5601, 'tcp', 'Kibana', 'high', 'Often unauthenticated.'],
  [5900, 'tcp', 'VNC', 'critical', 'Weak/no passwords are common.'],
  [5985, 'tcp', 'WinRM HTTP', 'high', 'Remote PowerShell.'],
  [5986, 'tcp', 'WinRM HTTPS', 'medium', ''],
  [6379, 'tcp', 'Redis', 'critical', 'No auth by default — remote code execution via config tricks.'],
  [6443, 'tcp', 'Kubernetes API', 'high', 'Check anonymous auth.'],
  [8000, 'tcp', 'HTTP alt / dev', 'medium', ''],
  [8080, 'tcp', 'HTTP proxy / Tomcat', 'medium', 'Check Tomcat manager default creds.'],
  [8443, 'tcp', 'HTTPS alt', 'low', ''],
  [8888, 'tcp', 'Jupyter', 'critical', 'Unauthenticated Jupyter = remote shell.'],
  [9000, 'tcp', 'PHP-FPM / SonarQube / Portainer', 'high', 'Exposed FastCGI allows code execution.'],
  [9090, 'tcp', 'Prometheus / Cockpit', 'medium', 'Metrics can leak internal info.'],
  [9100, 'tcp', 'Printer (JetDirect) / node_exporter', 'medium', ''],
  [9200, 'tcp', 'Elasticsearch', 'critical', 'Massive data leaks from open clusters.'],
  [10250, 'tcp', 'Kubelet API', 'critical', 'Can allow exec into pods.'],
  [11211, 'tcp/udp', 'Memcached', 'critical', 'Record-breaking DDoS amplification vector.'],
  [27017, 'tcp', 'MongoDB', 'critical', 'Unauthenticated instances get ransomed.'],
  [51820, 'udp', 'WireGuard', 'low', ''],
];

const RISK_COLOR = { critical: 'red', high: 'orange', medium: 'yellow', low: 'teal' };

export default function PortReference() {
  const [q, setQ] = useState('');
  const [risks, setRisks] = useState(['critical', 'high', 'medium', 'low']);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return PORTS.filter(([port, proto, svc, risk, note]) => risks.includes(risk)
      && (!s || String(port) === s || String(port).startsWith(s) || `${svc} ${proto} ${note}`.toLowerCase().includes(s)));
  }, [q, risks]);

  return (
    <Stack gap="md">
      <Group wrap="wrap">
        <TextInput placeholder="Search port or service (e.g. 3389, redis, database)…" leftSection={<IconSearch size={14} />} value={q} onChange={(e) => setQ(e.currentTarget.value)} w={360} />
        <Chip.Group multiple value={risks} onChange={(v) => setRisks(v.length ? v : ['critical', 'high', 'medium', 'low'])}>
          <Group gap={6}>{Object.keys(RISK_COLOR).map((r) => <Chip key={r} value={r} size="xs" color={RISK_COLOR[r]} variant="light">{r}</Chip>)}</Group>
        </Chip.Group>
        <Text size="xs" c="dimmed">{rows.length} ports</Text>
      </Group>
      <Table.ScrollContainer minWidth={640}>
        <Table striped highlightOnHover verticalSpacing={6}>
          <Table.Thead><Table.Tr><Table.Th>Port</Table.Th><Table.Th>Proto</Table.Th><Table.Th>Service</Table.Th><Table.Th>Exposure risk</Table.Th><Table.Th>Hardening note</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {rows.map(([port, proto, svc, risk, note]) => (
              <Table.Tr key={`${port}-${svc}`}>
                <Table.Td><Text ff="monospace" fw={600}>{port}</Text></Table.Td>
                <Table.Td><Text size="xs">{proto}</Text></Table.Td>
                <Table.Td><Text size="sm">{svc}</Text></Table.Td>
                <Table.Td><Badge size="sm" variant="light" color={RISK_COLOR[risk]}>{risk}</Badge></Table.Td>
                <Table.Td><Text size="xs" c="dimmed">{note}</Text></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <PrivacyNote>Offline reference for firewall reviews and audit reports. Risk = how dangerous it is to expose that port to the internet.</PrivacyNote>
    </Stack>
  );
}
