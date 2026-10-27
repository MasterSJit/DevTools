// Operations for the Cipher Lab recipe chain. Every op maps bytes → bytes so steps can be chained freely.
import {
  utf8Encode, utf8Decode, bytesToBase64, base64ToBytes, bytesToBase64Url, base32Encode, base32Decode,
  base58Encode, base58Decode, bytesToHex, hexToBytes, bytesToBinary, binaryToBytes, bytesToDecimal, decimalToBytes,
} from '@/shared/lib/encoding';

const text = (fn) => (bytes, args) => utf8Encode(fn(utf8Decode(bytes), args));
const fromText = (fn) => (bytes, args) => fn(utf8Decode(bytes).trim(), args);

const shiftLetters = (s, n) => s.replace(/[a-z]/gi, (c) => {
  const base = c <= 'Z' ? 65 : 97;
  return String.fromCharCode(((c.charCodeAt(0) - base + n) % 26 + 26) % 26 + base);
});

function vigenere(s, key, dir) {
  const k = key.toLowerCase().replace(/[^a-z]/g, '');
  if (!k) throw new Error('Vigenère key must contain letters');
  let j = 0;
  return s.replace(/[a-z]/gi, (c) => {
    const shift = (k.charCodeAt(j++ % k.length) - 97) * dir;
    return shiftLetters(c, shift);
  });
}

const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...',
  8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.',
  '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-',
  _: '..--.-', '"': '.-..-.', $: '...-..-', '@': '.--.-.',
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

const HTML_ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function xorBytes(bytes, { key = '', keyFormat = 'text' }) {
  const k = keyFormat === 'hex' ? hexToBytes(key) : utf8Encode(key);
  if (!k.length) throw new Error('XOR key is empty');
  return bytes.map((b, i) => b ^ k[i % k.length]);
}

export const OPERATIONS = {
  'to-base64': { label: 'To Base64', group: 'Encoding', fn: (b) => utf8Encode(bytesToBase64(b)) },
  'from-base64': { label: 'From Base64', group: 'Encoding', fn: fromText(base64ToBytes) },
  'to-base64url': { label: 'To Base64URL', group: 'Encoding', fn: (b) => utf8Encode(bytesToBase64Url(b)) },
  'to-base32': { label: 'To Base32', group: 'Encoding', fn: (b) => utf8Encode(base32Encode(b)) },
  'from-base32': { label: 'From Base32', group: 'Encoding', fn: fromText(base32Decode) },
  'to-base58': { label: 'To Base58', group: 'Encoding', fn: (b) => utf8Encode(base58Encode(b)) },
  'from-base58': { label: 'From Base58', group: 'Encoding', fn: fromText(base58Decode) },
  'to-hex': { label: 'To Hex', group: 'Encoding', args: [{ name: 'separator', label: 'Separator', default: ' ' }], fn: (b, a) => utf8Encode(bytesToHex(b, a.separator ?? '')) },
  'from-hex': { label: 'From Hex', group: 'Encoding', fn: fromText(hexToBytes) },
  'to-binary': { label: 'To Binary', group: 'Encoding', fn: (b) => utf8Encode(bytesToBinary(b)) },
  'from-binary': { label: 'From Binary', group: 'Encoding', fn: fromText(binaryToBytes) },
  'to-decimal': { label: 'To Decimal bytes', group: 'Encoding', fn: (b) => utf8Encode(bytesToDecimal(b)) },
  'from-decimal': { label: 'From Decimal bytes', group: 'Encoding', fn: fromText(decimalToBytes) },
  'url-encode': { label: 'URL Encode', group: 'Web', fn: text((s) => encodeURIComponent(s)) },
  'url-decode': { label: 'URL Decode', group: 'Web', fn: text((s) => decodeURIComponent(s.replace(/\+/g, ' '))) },
  'html-encode': { label: 'HTML Entity Encode', group: 'Web', fn: text((s) => s.replace(/[&<>"']/g, (c) => HTML_ENT[c])) },
  'html-decode': {
    label: 'HTML Entity Decode', group: 'Web',
    fn: text((s) => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; }),
  },
  'unicode-escape': {
    label: 'Unicode Escape (\\uXXXX)', group: 'Web',
    fn: text((s) => Array.from(s).map((c) => {
      const cp = c.codePointAt(0);
      if (cp < 128) return c;
      return cp > 0xffff ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, '0')}`;
    }).join('')),
  },
  'unicode-unescape': {
    label: 'Unicode Unescape', group: 'Web',
    fn: text((s) => s.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi, (_, a, b, c) => String.fromCodePoint(parseInt(a || b || c, 16)))),
  },
  rot13: { label: 'ROT13', group: 'Classic ciphers', fn: text((s) => shiftLetters(s, 13)) },
  rot47: {
    label: 'ROT47', group: 'Classic ciphers',
    fn: text((s) => s.replace(/[!-~]/g, (c) => String.fromCharCode(33 + ((c.charCodeAt(0) + 14) % 94)))),
  },
  caesar: {
    label: 'Caesar shift', group: 'Classic ciphers', args: [{ name: 'shift', label: 'Shift', default: 3, type: 'number' }],
    fn: text((s, a) => shiftLetters(s, Number(a.shift) || 0)),
  },
  atbash: {
    label: 'Atbash', group: 'Classic ciphers',
    fn: text((s) => s.replace(/[a-z]/gi, (c) => { const base = c <= 'Z' ? 65 : 97; return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base)); })),
  },
  'vigenere-encode': { label: 'Vigenère encode', group: 'Classic ciphers', args: [{ name: 'key', label: 'Key', default: 'KEY' }], fn: text((s, a) => vigenere(s, a.key, 1)) },
  'vigenere-decode': { label: 'Vigenère decode', group: 'Classic ciphers', args: [{ name: 'key', label: 'Key', default: 'KEY' }], fn: text((s, a) => vigenere(s, a.key, -1)) },
  xor: {
    label: 'XOR', group: 'Classic ciphers',
    args: [{ name: 'key', label: 'Key', default: 'key' }, { name: 'keyFormat', label: 'Key format', default: 'text', options: ['text', 'hex'] }],
    fn: xorBytes,
  },
  'a1z26-encode': { label: 'A1Z26 encode', group: 'Classic ciphers', fn: text((s) => s.toUpperCase().split(/\s+/).map((w) => [...w].filter((c) => /[A-Z]/.test(c)).map((c) => c.charCodeAt(0) - 64).join('-')).join(' ')) },
  'a1z26-decode': { label: 'A1Z26 decode', group: 'Classic ciphers', fn: text((s) => s.split(/\s+/).map((w) => w.split(/[-,]/).filter(Boolean).map((n) => String.fromCharCode(64 + Number(n))).join('')).join(' ')) },
  'to-morse': {
    label: 'To Morse', group: 'Classic ciphers',
    fn: text((s) => s.toUpperCase().split(/\s+/).map((w) => [...w].map((c) => MORSE[c] || '').filter(Boolean).join(' ')).join(' / ')),
  },
  'from-morse': {
    label: 'From Morse', group: 'Classic ciphers',
    fn: text((s) => s.trim().split(/\s*[/|]\s*|\s{3,}/).map((w) => w.split(/\s+/).map((c) => MORSE_REV[c] || '?').join('')).join(' ')),
  },
  reverse: { label: 'Reverse', group: 'Text', fn: text((s) => Array.from(s).reverse().join('')) },
  upper: { label: 'Uppercase', group: 'Text', fn: text((s) => s.toUpperCase()) },
  lower: { label: 'Lowercase', group: 'Text', fn: text((s) => s.toLowerCase()) },
  'remove-whitespace': { label: 'Remove whitespace', group: 'Text', fn: text((s) => s.replace(/\s+/g, '')) },
};

export const OP_GROUPS = [...new Set(Object.values(OPERATIONS).map((o) => o.group))];

export function defaultArgs(opId) {
  return Object.fromEntries((OPERATIONS[opId].args || []).map((a) => [a.name, a.default]));
}

/** Runs the recipe; returns final bytes or the index + message of the failing step. */
export function runRecipe(input, steps) {
  let data = utf8Encode(input);
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.disabled) continue;
    try { data = OPERATIONS[step.op].fn(data, step.args || {}); }
    catch (e) { return { error: e.message, failedAt: i, data }; }
  }
  return { data };
}

// ── English-likeness scoring for brute-force helpers ──
const FREQ = { e: 12.7, t: 9.1, a: 8.2, o: 7.5, i: 7.0, n: 6.7, s: 6.3, h: 6.1, r: 6.0, d: 4.3, l: 4.0, c: 2.8, u: 2.8, m: 2.4, w: 2.4, f: 2.2, g: 2.0, y: 2.0, p: 1.9, b: 1.5, v: 1.0, k: 0.8, j: 0.15, x: 0.15, q: 0.1, z: 0.07 };

export function englishScore(str) {
  if (!str.length) return 0;
  let score = 0;
  for (const ch of str.toLowerCase()) {
    if (FREQ[ch]) score += FREQ[ch];
    else if (ch === ' ') score += 13;
    else if (/[0-9.,'!?\-]/.test(ch)) score += 1;
    else if (ch < ' ' && ch !== '\n' && ch !== '\t') score -= 25;
    else if (ch > '~') score -= 10;
  }
  return score / str.length;
}

export const caesarAll = (s) => Array.from({ length: 26 }, (_, shift) => {
  const out = shiftLetters(s, -shift);
  return { shift, out, score: englishScore(out) };
});

export function singleByteXorAll(bytes) {
  const results = [];
  for (let k = 0; k < 256; k++) {
    const out = bytes.map((b) => b ^ k);
    let s = '';
    for (const b of out) s += String.fromCharCode(b);
    results.push({ key: k, out: s, score: englishScore(s) });
  }
  return results.sort((a, b) => b.score - a.score);
}
