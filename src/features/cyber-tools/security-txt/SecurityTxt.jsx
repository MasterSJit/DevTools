import { useMemo, useState } from 'react';
import { Stack, SimpleGrid, TextInput, Textarea, MultiSelect, Text, Alert } from '@mantine/core';
import { Panel, OutputArea, FindingList, PrivacyNote } from '@/shared/components/ui';

const LANGS = ['en', 'hi', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt', 'ar'];

const inOneYear = () => {
  const d = new Date(); d.setFullYear(d.getFullYear() + 1); d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().replace('.000', '');
};

export default function SecurityTxt() {
  const [contact, setContact] = useState('mailto:security@example.com\nhttps://example.com/security/report');
  const [expires, setExpires] = useState(inOneYear());
  const [encryption, setEncryption] = useState('');
  const [policy, setPolicy] = useState('https://example.com/security/policy');
  const [ack, setAck] = useState('https://example.com/security/hall-of-fame');
  const [hiring, setHiring] = useState('');
  const [canonical, setCanonical] = useState('https://example.com/.well-known/security.txt');
  const [langs, setLangs] = useState(['en']);

  const lines = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const output = useMemo(() => {
    const out = ['# Generated with DevForge — RFC 9116', ''];
    lines(contact).forEach((c) => out.push(`Contact: ${c}`));
    if (expires) out.push(`Expires: ${expires}`);
    lines(encryption).forEach((e) => out.push(`Encryption: ${e}`));
    if (ack) out.push(`Acknowledgments: ${ack}`);
    if (langs.length) out.push(`Preferred-Languages: ${langs.join(', ')}`);
    lines(canonical).forEach((c) => out.push(`Canonical: ${c}`));
    if (policy) out.push(`Policy: ${policy}`);
    if (hiring) out.push(`Hiring: ${hiring}`);
    return `${out.join('\n')}\n`;
  }, [contact, expires, encryption, policy, ack, hiring, canonical, langs]);

  const findings = useMemo(() => {
    const f = [];
    const contacts = lines(contact);
    if (!contacts.length) f.push({ level: 'high', title: 'Contact is required', detail: 'At least one mailto:, tel: or https:// URI.' });
    contacts.filter((c) => !/^(mailto:|tel:|https:\/\/)/i.test(c)).forEach((c) => f.push({ level: 'high', title: `Invalid contact “${c}”`, detail: 'Must start with mailto:, tel: or https://' }));
    const exp = Date.parse(expires);
    if (!expires || Number.isNaN(exp)) f.push({ level: 'high', title: 'Expires is required (ISO 8601)', detail: 'e.g. 2027-01-01T00:00:00Z' });
    else if (exp < Date.now()) f.push({ level: 'high', title: 'Expires is in the past' });
    else if (exp - Date.now() > 366 * 864e5) f.push({ level: 'low', title: 'Expires more than a year away', detail: 'RFC 9116 recommends less than a year so stale info isn’t trusted.' });
    [...lines(encryption), policy, ack, hiring, ...lines(canonical)].filter(Boolean).filter((u) => /^http:\/\//i.test(u))
      .forEach((u) => f.push({ level: 'medium', title: `Insecure URL: ${u}`, detail: 'Web URIs must use https://' }));
    if (!encryption) f.push({ level: 'info', title: 'No encryption key', detail: 'Optional, but lets researchers send sensitive reports encrypted (link to your PGP key).' });
    if (!f.some((x) => ['high', 'medium'].includes(x.level))) f.unshift({ level: 'pass', title: 'Valid security.txt' });
    return f;
  }, [contact, expires, encryption, policy, ack, hiring, canonical]);

  return (
    <Stack gap="md">
      <Alert variant="light" color="blue" p="xs">
        <Text size="xs">security.txt (RFC 9116) tells researchers how to report vulnerabilities. Serve it at <b>/.well-known/security.txt</b> over HTTPS.</Text>
      </Alert>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Panel title="Fields">
          <Stack gap="sm">
            <Textarea label="Contact (one per line) *" value={contact} onChange={(e) => setContact(e.currentTarget.value)} autosize minRows={2} />
            <TextInput label="Expires *" value={expires} onChange={(e) => setExpires(e.currentTarget.value)} />
            <Textarea label="Encryption key URL(s)" placeholder="https://example.com/pgp-key.txt" value={encryption} onChange={(e) => setEncryption(e.currentTarget.value)} autosize minRows={1} />
            <TextInput label="Policy" value={policy} onChange={(e) => setPolicy(e.currentTarget.value)} />
            <TextInput label="Acknowledgments" value={ack} onChange={(e) => setAck(e.currentTarget.value)} />
            <Textarea label="Canonical URL(s)" value={canonical} onChange={(e) => setCanonical(e.currentTarget.value)} autosize minRows={1} />
            <MultiSelect label="Preferred languages" data={LANGS} value={langs} onChange={setLangs} searchable />
            <TextInput label="Hiring" value={hiring} onChange={(e) => setHiring(e.currentTarget.value)} />
          </Stack>
        </Panel>
        <Stack gap="md">
          <OutputArea label="security.txt" value={output} minRows={12} filename="security.txt" />
          <Panel title="Validation"><FindingList findings={findings} /></Panel>
        </Stack>
      </SimpleGrid>
      <PrivacyNote />
    </Stack>
  );
}
