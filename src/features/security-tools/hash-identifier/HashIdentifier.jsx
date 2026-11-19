import { useMemo, useState } from 'react';
import { Stack, Paper, Group, Text, Badge, Table, Code, Alert, Button } from '@mantine/core';
import { IconFingerprint, IconInfoCircle } from '@tabler/icons-react';
import { InputArea, PrivacyNote } from '@/shared/components/ui';
import CopyButton from '@/shared/components/CopyButton';
import { identifyHash } from './hashTypes';

const CISCO7_KEY = 'dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87';

/** Cisco "type 7" is a reversible Vigenère-style XOR — decode it on the spot. */
function decodeCisco7(s) {
  try {
    const seed = Number(s.slice(0, 2));
    let out = '';
    for (let i = 2, j = 0; i < s.length; i += 2, j++) out += String.fromCharCode(parseInt(s.substr(i, 2), 16) ^ CISCO7_KEY.charCodeAt((seed + j) % CISCO7_KEY.length));
    return /^[\x20-\x7e]+$/.test(out) ? out : null;
  } catch { return null; }
}

const SAMPLES = [
  '5f4dcc3b5aa765d61d8327deb882cf99',
  '$2y$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  '*2470C0C06DEE42FD1618BB99005ADCA2EC9D1E19',
  '$P$B55D6LjfHDkINU5wF.v2BuuzO0/XPk/',
  '0822455D0A16',
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
];

const CONF = { high: 'teal', medium: 'yellow', low: 'gray' };

export default function HashIdentifier() {
  const [input, setInput] = useState(SAMPLES.join('\n'));

  const rows = useMemo(() => input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 200)
    .map((h) => ({ hash: h, matches: identifyHash(h) })), [input]);

  return (
    <Stack gap="md">
      <InputArea label="Hashes (one per line)" value={input} onChange={setInput} minRows={5} maxRows={12}
        actions={<Button size="compact-xs" variant="subtle" onClick={() => setInput(SAMPLES.join('\n'))}>Samples</Button>} />
      {rows.map(({ hash, matches }, i) => {
        const cisco = matches.some((m) => m.weak) ? decodeCisco7(hash) : null;
        return (
          <Paper key={i} p="sm">
            <Group justify="space-between" wrap="nowrap" mb={matches.length ? 'xs' : 0}>
              <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                <IconFingerprint size={16} className="text-indigo-500 shrink-0" />
                <Text ff="monospace" size="xs" truncate="end">{hash}</Text>
              </Group>
              <Badge variant="light" color={matches.length ? 'indigo' : 'gray'}>{matches.length ? `${matches.length} candidate${matches.length > 1 ? 's' : ''}` : 'Unknown'}</Badge>
            </Group>
            {cisco && (
              <Alert color="red" variant="light" p="xs" mb="xs">
                Cisco type 7 decodes instantly to: <Code>{cisco}</Code> <CopyButton value={cisco} icon /> — replace it with <Code>secret 9</Code> / <Code>algorithm-type scrypt</Code>.
              </Alert>
            )}
            {matches.length > 0 && (
              <Table.ScrollContainer minWidth={520}>
                <Table verticalSpacing={4} striped withRowBorders={false}>
                  <Table.Thead>
                    <Table.Tr><Table.Th>Type</Table.Th><Table.Th>Confidence</Table.Th><Table.Th>Hashcat</Table.Th><Table.Th>John</Table.Th></Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {matches.map((m, j) => (
                      <Table.Tr key={j}>
                        <Table.Td><Text size="sm">{m.name}</Text>{m.note && <Text size="xs" c="dimmed">{m.note}</Text>}</Table.Td>
                        <Table.Td><Badge size="xs" variant="light" color={CONF[m.confidence]}>{m.confidence}</Badge></Table.Td>
                        <Table.Td>
                          {m.hc != null ? (
                            <Group gap={2} wrap="nowrap">
                              <Code>-m {m.hc}</Code>
                              <CopyButton value={`hashcat -m ${m.hc} -a 0 hash.txt rockyou.txt`} icon />
                            </Group>
                          ) : <Text size="xs" c="dimmed">—</Text>}
                        </Table.Td>
                        <Table.Td>{m.john ? <Code>--format={m.john}</Code> : <Text size="xs" c="dimmed">—</Text>}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Paper>
        );
      })}
      <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />} p="xs">
        Same-length raw hex is ambiguous (MD5 vs NTLM vs MD4 are all 32 chars) — the most common type is listed first. Use the Hash Cracker to test candidates against a wordlist.
      </Alert>
      <PrivacyNote>Identification is pattern-based and runs locally; hashes never leave your browser.</PrivacyNote>
    </Stack>
  );
}
