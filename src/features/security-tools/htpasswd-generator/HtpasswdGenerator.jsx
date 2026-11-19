import { useState } from 'react';
import { Stack, SimpleGrid, TextInput, PasswordInput, SegmentedControl, Button, Group, Slider, Text, Alert, Code, Table, ActionIcon } from '@mantine/core';
import { IconPlus, IconTrash, IconDice5 } from '@tabler/icons-react';
import { Panel, OutputArea, PrivacyNote } from '@/shared/components/ui';
import { apr1, sha1Htpasswd, randomSalt, safeEqual } from './apr1';
import { randomInt } from '@/shared/lib/crypto';

const ALGOS = [
  { value: 'bcrypt', label: 'bcrypt (recommended)' },
  { value: 'apr1', label: 'APR1-MD5' },
  { value: 'sha1', label: 'SHA-1 (legacy)' },
];

const USER_RE = /^[^:\s]{1,255}$/;

function strongPassword(len = 20) {
  const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%^*-_=+';
  return Array.from({ length: len }, () => cs[randomInt(cs.length)]).join('');
}

async function hashFor(algo, pw, cost) {
  if (algo === 'apr1') return apr1(pw, randomSalt());
  if (algo === 'sha1') return sha1Htpasswd(pw);
  const bcrypt = (await import('bcryptjs')).default;
  return (await bcrypt.hash(pw, cost)).replace(/^\$2[ab]\$/, '$2y$');
}

async function verifyLine(line, pw) {
  const [user, hash] = [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()];
  if (!user || !hash) throw new Error('Expected user:hash');
  let ok;
  if (hash.startsWith('$apr1$')) ok = safeEqual(apr1(pw, hash.split('$')[2]), hash);
  else if (hash.startsWith('{SHA}')) ok = safeEqual(await sha1Htpasswd(pw), hash);
  else if (/^\$2[aby]\$/.test(hash)) ok = await (await import('bcryptjs')).default.compare(pw, hash.replace(/^\$2y\$/, '$2a$'));
  else throw new Error('Unsupported hash (crypt/plain are insecure and not supported).');
  return { user, ok };
}

export default function HtpasswdGenerator() {
  const [algo, setAlgo] = useState('bcrypt');
  const [cost, setCost] = useState(11);
  const [users, setUsers] = useState([{ user: 'admin', pw: '' }]);
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [vLine, setVLine] = useState('');
  const [vPw, setVPw] = useState('');
  const [vRes, setVRes] = useState(null);

  const setU = (i, p) => setUsers((u) => u.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const generate = async () => {
    setErr(null);
    const bad = users.find((u) => !USER_RE.test(u.user) || !u.pw);
    if (bad) { setErr('Every row needs a username (no spaces or colons) and a password.'); return; }
    setBusy(true);
    try { setOut(`${(await Promise.all(users.map(async (u) => `${u.user}:${await hashFor(algo, u.pw, cost)}`))).join('\n')}\n`); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const verify = async () => {
    try { setVRes(await verifyLine(vLine.trim(), vPw)); } catch (e) { setVRes({ error: e.message }); }
  };

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title="Users">
          <Stack gap="sm">
            <SegmentedControl value={algo} onChange={setAlgo} data={ALGOS} />
            {algo === 'bcrypt' && (
              <div>
                <Text size="xs" fw={600} c="dimmed" mb={4}>COST FACTOR · {cost} ({2 ** cost} rounds)</Text>
                <Slider value={cost} onChange={setCost} min={8} max={14} marks={[{ value: 10 }, { value: 12 }]} />
              </div>
            )}
            {algo === 'sha1' && <Alert color="orange" variant="light" p="xs"><Text size="xs">SHA-1 htpasswd is unsalted and fast to brute-force. Use bcrypt unless an old server forces this.</Text></Alert>}
            <Table verticalSpacing={4}>
              <Table.Tbody>
                {users.map((u, i) => (
                  <Table.Tr key={i}>
                    <Table.Td w="40%"><TextInput size="xs" placeholder="username" value={u.user} error={u.user && !USER_RE.test(u.user)} onChange={(e) => setU(i, { user: e.currentTarget.value })} /></Table.Td>
                    <Table.Td><PasswordInput size="xs" placeholder="password" value={u.pw} onChange={(e) => setU(i, { pw: e.currentTarget.value })} /></Table.Td>
                    <Table.Td w={64}>
                      <Group gap={2} wrap="nowrap">
                        <ActionIcon variant="subtle" size="sm" aria-label="Generate strong password" onClick={() => setU(i, { pw: strongPassword() })}><IconDice5 size={14} /></ActionIcon>
                        <ActionIcon variant="subtle" color="red" size="sm" aria-label="Remove user" disabled={users.length === 1} onClick={() => setUsers((x) => x.filter((_, j) => j !== i))}><IconTrash size={14} /></ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group>
              <Button variant="default" size="xs" leftSection={<IconPlus size={14} />} onClick={() => setUsers((u) => [...u, { user: '', pw: '' }])}>Add user</Button>
              <Button size="xs" onClick={generate} loading={busy}>Generate .htpasswd</Button>
            </Group>
            {err && <Alert color="red" variant="light" p="xs">{err}</Alert>}
          </Stack>
        </Panel>
        <Stack gap="md">
          <OutputArea label=".htpasswd" value={out} minRows={5} filename=".htpasswd" />
          <Panel title="Apache / Nginx config">
            <Text size="xs" c="dimmed" mb={4}>Apache (.htaccess)</Text>
            <Code block>{'AuthType Basic\nAuthName "Restricted"\nAuthUserFile /etc/apache2/.htpasswd\nRequire valid-user'}</Code>
            <Text size="xs" c="dimmed" mt="sm" mb={4}>Nginx</Text>
            <Code block>{'auth_basic "Restricted";\nauth_basic_user_file /etc/nginx/.htpasswd;'}</Code>
            <Text size="xs" c="dimmed" mt="sm">Keep the file outside the web root and serve the site over HTTPS only — Basic auth sends credentials on every request.</Text>
          </Panel>
        </Stack>
      </SimpleGrid>
      <Panel title="Verify a line">
        <Group align="flex-end" wrap="wrap">
          <TextInput style={{ flex: 2, minWidth: 260 }} label="htpasswd line" placeholder="admin:$apr1$…" value={vLine} onChange={(e) => setVLine(e.currentTarget.value)} />
          <PasswordInput style={{ flex: 1, minWidth: 180 }} label="Password" value={vPw} onChange={(e) => setVPw(e.currentTarget.value)} />
          <Button onClick={verify} disabled={!vLine || !vPw}>Check</Button>
        </Group>
        {vRes && (
          <Alert mt="sm" p="xs" variant="light" color={vRes.error ? 'red' : vRes.ok ? 'teal' : 'orange'}>
            {vRes.error || (vRes.ok ? `Password is correct for “${vRes.user}”.` : `Password does not match “${vRes.user}”.`)}
          </Alert>
        )}
      </Panel>
      <PrivacyNote>Passwords are hashed locally. APR1 output is byte-identical to <code>openssl passwd -apr1</code>.</PrivacyNote>
    </Stack>
  );
}
