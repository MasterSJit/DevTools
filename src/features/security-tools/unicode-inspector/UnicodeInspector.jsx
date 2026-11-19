import { useMemo, useState } from 'react';
import { Stack, SimpleGrid, Table, Text, Badge, Button, Group, Code } from '@mantine/core';
import { IconEraser } from '@tabler/icons-react';
import { InputArea, OutputArea, Panel, FindingList, Stat, PrivacyNote } from '@/shared/components/ui';

// Invisible / formatting characters often abused for spoofing, watermarking or "Trojan Source" attacks.
const INVISIBLE = {
  0x00ad: 'Soft hyphen', 0x034f: 'Combining grapheme joiner', 0x061c: 'Arabic letter mark', 0x115f: 'Hangul choseong filler',
  0x1160: 'Hangul jungseong filler', 0x17b4: 'Khmer vowel inherent AQ', 0x17b5: 'Khmer vowel inherent AA', 0x180e: 'Mongolian vowel separator',
  0x200b: 'Zero width space', 0x200c: 'Zero width non-joiner', 0x200d: 'Zero width joiner', 0x200e: 'Left-to-right mark',
  0x200f: 'Right-to-left mark', 0x2060: 'Word joiner', 0x2061: 'Function application', 0x2062: 'Invisible times',
  0x2063: 'Invisible separator', 0x2064: 'Invisible plus', 0x3164: 'Hangul filler', 0xfeff: 'Zero width no-break space (BOM)',
  0xffa0: 'Halfwidth Hangul filler',
};
const BIDI = {
  0x202a: 'LRE (left-to-right embedding)', 0x202b: 'RLE (right-to-left embedding)', 0x202c: 'PDF (pop directional formatting)',
  0x202d: 'LRO (left-to-right override)', 0x202e: 'RLO (right-to-left override)', 0x2066: 'LRI (left-to-right isolate)',
  0x2067: 'RLI (right-to-left isolate)', 0x2068: 'FSI (first strong isolate)', 0x2069: 'PDI (pop directional isolate)',
};
const SPACES = { 0x00a0: 'No-break space', 0x2000: 'En quad', 0x2001: 'Em quad', 0x2002: 'En space', 0x2003: 'Em space', 0x2004: 'Three-per-em space',
  0x2005: 'Four-per-em space', 0x2006: 'Six-per-em space', 0x2007: 'Figure space', 0x2008: 'Punctuation space', 0x2009: 'Thin space',
  0x200a: 'Hair space', 0x202f: 'Narrow no-break space', 0x205f: 'Medium math space', 0x3000: 'Ideographic space' };
// Common Latin look-alikes from Cyrillic / Greek.
const CONFUSABLE = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'һ': 'h', 'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w',
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'І': 'I', 'Ј': 'J', 'Ѕ': 'S',
  'α': 'a', 'ο': 'o', 'ρ': 'p', 'ν': 'v', 'τ': 't', 'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N',
  'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X', 'ı': 'i', 'ℓ': 'l', '０': '0', '１': '1', 'ⅰ': 'i', 'ⅼ': 'l',
};

function script(cp) {
  if (cp < 0x80) return 'Latin';
  if (cp >= 0x80 && cp <= 0x24f) return 'Latin';
  if (cp >= 0x370 && cp <= 0x3ff) return 'Greek';
  if (cp >= 0x400 && cp <= 0x52f) return 'Cyrillic';
  if (cp >= 0x590 && cp <= 0x5ff) return 'Hebrew';
  if (cp >= 0x600 && cp <= 0x6ff) return 'Arabic';
  if (cp >= 0x900 && cp <= 0x97f) return 'Devanagari';
  if (cp >= 0x4e00 && cp <= 0x9fff) return 'CJK';
  if (cp >= 0x1f000) return 'Emoji/Symbol';
  return 'Other';
}

const hex = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;

export default function UnicodeInspector() {
  const [input, setInput] = useState('Pay to: аpple.com​  // admin‮ } ⁦if (isAdmin)⁩ { ');

  const analysis = useMemo(() => {
    const chars = Array.from(input);
    const flagged = [];
    const scripts = new Map();
    chars.forEach((ch, i) => {
      const cp = ch.codePointAt(0);
      const sc = script(cp);
      if (/\p{L}/u.test(ch)) scripts.set(sc, (scripts.get(sc) || 0) + 1);
      let kind = null, name = null;
      if (INVISIBLE[cp]) { kind = 'invisible'; name = INVISIBLE[cp]; }
      else if (BIDI[cp]) { kind = 'bidi'; name = BIDI[cp]; }
      else if (SPACES[cp]) { kind = 'space'; name = SPACES[cp]; }
      else if (CONFUSABLE[ch]) { kind = 'confusable'; name = `${sc} “${ch}” looks like Latin “${CONFUSABLE[ch]}”`; }
      else if ((cp < 32 && ![9, 10, 13].includes(cp)) || (cp >= 0x7f && cp < 0xa0)) { kind = 'control'; name = 'Control character'; }
      else if (cp >= 0xe0000 && cp <= 0xe007f) { kind = 'invisible'; name = 'Tag character (can hide text, e.g. prompt injection)'; }
      else if (cp >= 0xfe00 && cp <= 0xfe0f) { kind = 'invisible'; name = 'Variation selector'; }
      if (kind) flagged.push({ i, ch, cp, kind, name });
    });
    const count = (k) => flagged.filter((f) => f.kind === k).length;
    const findings = [];
    if (count('bidi')) findings.push({ level: 'critical', title: `${count('bidi')} bidirectional control character(s)`, detail: 'Can make code display differently from how it compiles (Trojan Source, CVE-2021-42574) or disguise file names like “invoice‮fdp.exe”.' });
    if (count('invisible')) findings.push({ level: 'high', title: `${count('invisible')} invisible character(s)`, detail: 'Zero-width / tag characters can hide content, break string comparisons, fingerprint leaked text or smuggle hidden instructions.' });
    if (count('confusable')) findings.push({ level: 'high', title: `${count('confusable')} homoglyph(s)`, detail: 'Look-alike letters from other scripts — the classic IDN phishing trick (аpple.com with a Cyrillic “а”).' });
    const letterScripts = [...scripts.keys()].filter((s) => !['Emoji/Symbol', 'Other'].includes(s));
    if (letterScripts.length > 1) findings.push({ level: 'medium', title: `Mixed scripts: ${letterScripts.join(', ')}`, detail: 'Mixing scripts inside one word or identifier is a strong spoofing indicator.' });
    if (count('control')) findings.push({ level: 'medium', title: `${count('control')} control character(s)`, detail: 'Unexpected control bytes can break parsers or terminals (ANSI escape injection).' });
    if (count('space')) findings.push({ level: 'low', title: `${count('space')} unusual space(s)`, detail: 'Non-standard spaces can bypass filters or break code.' });
    if (input.normalize('NFKC') !== input) findings.push({ level: 'info', title: 'Text changes under NFKC normalization', detail: 'Compatibility characters (fullwidth, ligatures, styled letters) are present.' });
    if (!findings.length) findings.push({ level: 'pass', title: 'Clean text', detail: 'No hidden, bidi or look-alike characters found.' });

    const cleaned = chars.filter((ch) => { const c = ch.codePointAt(0); return !INVISIBLE[c] && !BIDI[c] && !(c >= 0xe0000 && c <= 0xe007f); })
      .map((ch) => CONFUSABLE[ch] || (SPACES[ch.codePointAt(0)] ? ' ' : ch)).join('');
    const revealed = chars.map((ch) => { const c = ch.codePointAt(0); return INVISIBLE[c] || BIDI[c] || (c >= 0xe0000 && c <= 0xe007f) ? `[${hex(c)}]` : ch; }).join('');
    return { chars, flagged, findings, cleaned, revealed, scripts };
  }, [input]);

  const kindColor = { bidi: 'red', invisible: 'orange', confusable: 'grape', control: 'yellow', space: 'gray' };

  return (
    <Stack gap="md">
      <InputArea label="Text, code, URL or filename" value={input} onChange={setInput} minRows={4} />
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Stat label="Characters" value={analysis.chars.length} />
        <Stat label="UTF-8 bytes" value={new TextEncoder().encode(input).length} />
        <Stat label="Suspicious" value={analysis.flagged.length} color={analysis.flagged.length ? 'red' : 'teal'} />
        <Stat label="Scripts" value={[...analysis.scripts.keys()].join(', ') || '—'} />
      </SimpleGrid>
      <Panel title="Findings"><FindingList findings={analysis.findings} /></Panel>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <OutputArea label="Revealed (hidden chars shown as [U+XXXX])" value={analysis.revealed} minRows={3} />
        <OutputArea label="Sanitized (hidden removed, homoglyphs → ASCII)" value={analysis.cleaned} minRows={3}
          actions={<Button size="compact-xs" variant="subtle" leftSection={<IconEraser size={12} />} onClick={() => setInput(analysis.cleaned)}>Apply</Button>} />
      </SimpleGrid>
      {analysis.flagged.length > 0 && (
        <Panel title="Flagged characters">
          <Table.ScrollContainer minWidth={480}>
            <Table striped verticalSpacing={4} withRowBorders={false}>
              <Table.Thead><Table.Tr><Table.Th>Pos</Table.Th><Table.Th>Code point</Table.Th><Table.Th>Type</Table.Th><Table.Th>Description</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {analysis.flagged.slice(0, 300).map((f) => (
                  <Table.Tr key={f.i}>
                    <Table.Td><Text size="xs" ff="monospace">{f.i}</Text></Table.Td>
                    <Table.Td><Code>{hex(f.cp)}</Code></Table.Td>
                    <Table.Td><Badge size="xs" variant="light" color={kindColor[f.kind]}>{f.kind}</Badge></Table.Td>
                    <Table.Td><Text size="xs">{f.name}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Panel>
      )}
      <Group><PrivacyNote /></Group>
    </Stack>
  );
}
