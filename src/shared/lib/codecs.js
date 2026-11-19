// Text codecs for the Encoder Hub and Magic Decoder. Each codec maps string ⇄ string.
// Byte-level codecs go through UTF-8 (or Latin-1 when the decoded bytes are not valid UTF-8).
import {
  utf8Encode, utf8Decode, latin1Decode, bytesToBase64, base64ToBytes, bytesToBase64Url,
  base32Encode, base32Decode, base58Encode, base58Decode, bytesToHex, hexToBytes, bytesToBinary, binaryToBytes,
  bytesToDecimal, decimalToBytes, punycodeDecode,
} from './encoding';

/** Bytes → string: UTF-8 when valid, otherwise Latin-1 so nothing is lost. */
export function bytesToText(bytes) {
  try { return utf8Decode(bytes, true); } catch { return latin1Decode(bytes); }
}

// ── Generic BigInt base-N (Base36 / Base62) ──
function baseNEncode(bytes, alphabet) {
  const base = BigInt(alphabet.length);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) { out = alphabet[Number(n % base)] + out; n /= base; }
  for (const b of bytes) { if (b !== 0) break; out = alphabet[0] + out; }
  return out || '';
}

function baseNDecode(str, alphabet, name) {
  const base = BigInt(alphabet.length);
  const s = str.trim();
  let n = 0n;
  for (const ch of s) {
    const i = alphabet.indexOf(ch);
    if (i < 0) throw new Error(`Invalid ${name} character "${ch}"`);
    n = n * base + BigInt(i);
  }
  const out = [];
  while (n > 0n) { out.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const ch of s) { if (ch !== alphabet[0]) break; out.unshift(0); }
  return new Uint8Array(out);
}

const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// ── Ascii85 (Adobe variant, with <~ ~>) ──
function ascii85Encode(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = [bytes[i] ?? 0, bytes[i + 1] ?? 0, bytes[i + 2] ?? 0, bytes[i + 3] ?? 0];
    const n = Math.min(4, bytes.length - i);
    let v = ((chunk[0] << 24) | (chunk[1] << 16) | (chunk[2] << 8) | chunk[3]) >>> 0;
    if (v === 0 && n === 4) { out += 'z'; continue; }
    const enc = [];
    for (let j = 0; j < 5; j++) { enc.unshift(String.fromCharCode((v % 85) + 33)); v = Math.floor(v / 85); }
    out += enc.slice(0, n + 1).join('');
  }
  return `<~${out}~>`;
}

function ascii85Decode(str) {
  const s = str.trim().replace(/^<~/, '').replace(/~>$/, '').replace(/\s+/g, '').replace(/z/g, '!!!!!');
  if (/[^!-u]/.test(s)) throw new Error('Invalid Ascii85 character');
  const out = [];
  for (let i = 0; i < s.length; i += 5) {
    const chunk = s.slice(i, i + 5);
    const n = chunk.length;
    const padded = chunk.padEnd(5, 'u');
    let v = 0;
    for (const c of padded) v = v * 85 + (c.charCodeAt(0) - 33);
    if (v > 0xffffffff) throw new Error('Invalid Ascii85 group');
    const b = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    out.push(...b.slice(0, n - 1));
  }
  return new Uint8Array(out);
}

// ── Z85 (ZeroMQ) — input length padded to a multiple of 4 ──
const Z85 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';
function z85Encode(bytes) {
  const pad = (4 - (bytes.length % 4)) % 4;
  const b = new Uint8Array(bytes.length + pad); b.set(bytes);
  let out = '';
  for (let i = 0; i < b.length; i += 4) {
    let v = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const enc = [];
    for (let j = 0; j < 5; j++) { enc.unshift(Z85[v % 85]); v = Math.floor(v / 85); }
    out += enc.join('');
  }
  return out;
}
function z85Decode(str) {
  const s = str.trim();
  if (s.length % 5) throw new Error('Z85 length must be a multiple of 5');
  const out = [];
  for (let i = 0; i < s.length; i += 5) {
    let v = 0;
    for (const c of s.slice(i, i + 5)) {
      const idx = Z85.indexOf(c);
      if (idx < 0) throw new Error(`Invalid Z85 character "${c}"`);
      v = v * 85 + idx;
    }
    out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  }
  while (out.length && out[out.length - 1] === 0) out.pop(); // drop the encoder's zero padding
  return new Uint8Array(out);
}

// ── Base45 (RFC 9285, used in EU COVID certificates) ──
const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
function base45Encode(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      let n = bytes[i] * 256 + bytes[i + 1];
      const c = n % 45; n = Math.floor(n / 45);
      const d = n % 45; const e = Math.floor(n / 45);
      out += B45[c] + B45[d] + B45[e];
    } else {
      const n = bytes[i];
      out += B45[n % 45] + B45[Math.floor(n / 45)];
    }
  }
  return out;
}
function base45Decode(str) {
  const s = str.trim();
  const v = [...s].map((c) => { const i = B45.indexOf(c); if (i < 0) throw new Error(`Invalid Base45 character "${c}"`); return i; });
  const out = [];
  for (let i = 0; i < v.length; i += 3) {
    if (i + 2 < v.length) {
      const n = v[i] + v[i + 1] * 45 + v[i + 2] * 2025;
      if (n > 0xffff) throw new Error('Invalid Base45 triplet');
      out.push(n >> 8, n & 255);
    } else if (i + 1 < v.length) {
      const n = v[i] + v[i + 1] * 45;
      if (n > 255) throw new Error('Invalid Base45 pair');
      out.push(n);
    } else throw new Error('Invalid Base45 length');
  }
  return new Uint8Array(out);
}

// ── Base91 (basE91 by Joachim Henke) ──
const B91 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';
function base91Encode(bytes) {
  let b = 0, n = 0, out = '';
  for (const byte of bytes) {
    b |= byte << n; n += 8;
    if (n > 13) {
      let v = b & 8191;
      if (v > 88) { b >>= 13; n -= 13; } else { v = b & 16383; b >>= 14; n -= 14; }
      out += B91[v % 91] + B91[Math.floor(v / 91)];
    }
  }
  if (n) { out += B91[b % 91]; if (n > 7 || b > 90) out += B91[Math.floor(b / 91)]; }
  return out;
}
function base91Decode(str) {
  let b = 0, n = 0, v = -1;
  const out = [];
  for (const ch of str.trim()) {
    const c = B91.indexOf(ch);
    if (c < 0) throw new Error(`Invalid Base91 character "${ch}"`);
    if (v < 0) { v = c; continue; }
    v += c * 91;
    b |= v << n;
    n += (v & 8191) > 88 ? 13 : 14;
    do { out.push(b & 255); b >>= 8; n -= 8; } while (n > 7);
    v = -1;
  }
  if (v > -1) out.push((b | (v << n)) & 255);
  return new Uint8Array(out);
}

// ── UUencode (body only, with begin/end wrapper) ──
const uuChar = (v) => String.fromCharCode(v === 0 ? 96 : v + 32);
function uuEncode(bytes) {
  const lines = ['begin 644 data'];
  for (let i = 0; i < bytes.length; i += 45) {
    const chunk = bytes.subarray(i, i + 45);
    let line = uuChar(chunk.length);
    for (let j = 0; j < chunk.length; j += 3) {
      const a = chunk[j], b = chunk[j + 1] ?? 0, c = chunk[j + 2] ?? 0;
      line += uuChar(a >> 2) + uuChar(((a << 4) | (b >> 4)) & 63) + uuChar(((b << 2) | (c >> 6)) & 63) + uuChar(c & 63);
    }
    lines.push(line);
  }
  lines.push('`', 'end');
  return lines.join('\n');
}
function uuDecode(str) {
  const lines = str.split(/\r?\n/).filter((l) => l && !/^begin /.test(l) && l !== 'end');
  const out = [];
  const val = (c) => (c.charCodeAt(0) - 32) & 63;
  for (const line of lines) {
    const len = val(line[0]);
    if (!len) continue;
    const bytes = [];
    for (let i = 1; i + 3 < line.length + 1 && bytes.length < len; i += 4) {
      const [a, b, c, d] = [line[i], line[i + 1] || '`', line[i + 2] || '`', line[i + 3] || '`'].map(val);
      bytes.push((a << 2) | (b >> 4), ((b << 4) | (c >> 2)) & 255, ((c << 6) | d) & 255);
    }
    out.push(...bytes.slice(0, len));
  }
  return new Uint8Array(out);
}

// ── Quoted-printable (RFC 2045) ──
function qpEncode(str) {
  const bytes = utf8Encode(str);
  let out = '', line = '';
  const push = (tok) => {
    if (line.length + tok.length > 75) { out += `${line}=\r\n`; line = ''; }
    line += tok;
  };
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 10) { out += `${line}\r\n`; line = ''; continue; }
    if (b === 13) continue;
    if ((b >= 33 && b <= 126 && b !== 61) || (b === 32 && bytes[i + 1] !== 10 && i !== bytes.length - 1)) push(String.fromCharCode(b));
    else push(`=${b.toString(16).toUpperCase().padStart(2, '0')}`);
  }
  return out + line;
}
function qpDecode(str) {
  const s = str.replace(/=\r?\n/g, '');
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.substr(i + 1, 2))) { out.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
    else out.push(...utf8Encode(s[i]));
  }
  return bytesToText(new Uint8Array(out));
}

// ── Punycode encode (RFC 3492) for a whole domain ──
function punycodeEncodeLabel(input) {
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
  const cps = Array.from(input, (c) => c.codePointAt(0));
  let out = cps.filter((c) => c < 128).map((c) => String.fromCharCode(c)).join('');
  const b = out.length; let h = b;
  if (b) out += '-';
  let n = 128, delta = 0, bias = 72;
  const adapt = (d, numPoints, first) => {
    d = first ? Math.floor(d / damp) : d >> 1;
    d += Math.floor(d / numPoints);
    let k = 0;
    while (d > ((base - tMin) * tMax) >> 1) { d = Math.floor(d / (base - tMin)); k += base; }
    return k + Math.floor(((base - tMin + 1) * d) / (d + skew));
  };
  const digit = (d) => String.fromCharCode(d + 22 + 75 * (d < 26));
  while (h < cps.length) {
    const m = Math.min(...cps.filter((c) => c >= n));
    delta += (m - n) * (h + 1); n = m;
    for (const c of cps) {
      if (c < n) delta++;
      if (c === n) {
        let q = delta;
        for (let k = base; ; k += base) {
          const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
          if (q < t) break;
          out += digit(t + ((q - t) % (base - t)));
          q = Math.floor((q - t) / (base - t));
        }
        out += digit(q);
        bias = adapt(delta, h + 1, h === b); delta = 0; h++;
      }
    }
    delta++; n++;
  }
  return out;
}
const punyEncode = (s) => s.split('.').map((l) => (/[^\x00-\x7f]/.test(l) ? `xn--${punycodeEncodeLabel(l.toLowerCase())}` : l)).join('.');
const punyDecode = (s) => s.split('.').map((l) => (/^xn--/i.test(l) ? punycodeDecode(l.slice(4)) : l)).join('.');

// ── Lookup-table codecs ──
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...',
  8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.',
  '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-',
  _: '..--.-', '"': '.-..-.', $: '...-..-', '@': '.--.-.',
};
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

const NATO = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima', 'Mike',
  'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'];
const NATO_DIGITS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

// Grade-1 braille, letters and digits (digits use the number sign ⠼)
const BR_LETTERS = '⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚⠅⠇⠍⠝⠕⠏⠟⠗⠎⠞⠥⠧⠺⠭⠽⠵';
const BR_PUNCT = { ' ': ' ', ',': '⠂', ';': '⠆', ':': '⠒', '.': '⠲', '!': '⠖', '?': '⠦', '-': '⠤', "'": '⠄' };
function brailleEncode(s) {
  let out = '', inNum = false;
  for (const ch of s.toLowerCase()) {
    if (/[0-9]/.test(ch)) {
      if (!inNum) { out += '⠼'; inNum = true; }
      out += BR_LETTERS[ch === '0' ? 9 : Number(ch) - 1];
      continue;
    }
    inNum = false;
    if (/[a-z]/.test(ch)) out += BR_LETTERS[ch.charCodeAt(0) - 97];
    else out += BR_PUNCT[ch] ?? ch;
  }
  return out;
}
function brailleDecode(s) {
  const punctRev = Object.fromEntries(Object.entries(BR_PUNCT).map(([k, v]) => [v, k]));
  let out = '', inNum = false;
  for (const ch of s) {
    if (ch === '⠼') { inNum = true; continue; }
    const i = BR_LETTERS.indexOf(ch);
    if (i >= 0) {
      if (inNum && i < 10) out += i === 9 ? '0' : String(i + 1);
      else { inNum = false; out += String.fromCharCode(97 + i); }
    } else { inNum = false; out += punctRev[ch] ?? ch; }
  }
  return out;
}

const LEET = { a: '4', b: '8', e: '3', g: '6', i: '1', l: '1', o: '0', s: '5', t: '7', z: '2' };
const LEET_REV = { 4: 'a', 8: 'b', 3: 'e', 6: 'g', 1: 'i', 0: 'o', 5: 's', 7: 't', 2: 'z', '@': 'a', $: 's' };

// Baconian cipher (26-letter variant)
const baconEncode = (s) => s.toUpperCase().replace(/[^A-Z]/g, '').split('')
  .map((c) => (c.charCodeAt(0) - 65).toString(2).padStart(5, '0').replace(/0/g, 'A').replace(/1/g, 'B')).join(' ');
const baconDecode = (s) => (s.toUpperCase().replace(/[^AB]/g, '').match(/.{5}/g) || [])
  .map((g) => String.fromCharCode(65 + parseInt(g.replace(/A/g, '0').replace(/B/g, '1'), 2))).join('');

// Tap code (5x5, K → C)
const TAP = 'ABCDEFGHIJLMNOPQRSTUVWXYZ';
const tapEncode = (s) => s.toUpperCase().replace(/K/g, 'C').replace(/[^A-Z ]/g, '').split('')
  .map((c) => (c === ' ' ? '/' : (() => { const i = TAP.indexOf(c); return '.'.repeat(Math.floor(i / 5) + 1) + ' ' + '.'.repeat((i % 5) + 1); })())).join('  ');
const tapDecode = (s) => s.split('/').map((word) => (word.trim().match(/\.+\s+\.+/g) || [])
  .map((p) => { const [r, c] = p.trim().split(/\s+/); return TAP[(r.length - 1) * 5 + (c.length - 1)] || '?'; }).join('')).join(' ');

const shift = (s, n) => s.replace(/[a-z]/gi, (c) => {
  const b = c <= 'Z' ? 65 : 97;
  return String.fromCharCode(((c.charCodeAt(0) - b + n) % 26 + 26) % 26 + b);
});
const rot47 = (s) => s.replace(/[!-~]/g, (c) => String.fromCharCode(33 + ((c.charCodeAt(0) + 14) % 94)));
const rot18 = (s) => shift(s, 13).replace(/[0-9]/g, (d) => String((Number(d) + 5) % 10));

const HTML_NAMED = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function htmlDecode(s) {
  if (typeof document !== 'undefined') { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; }
  return s.replace(/&(lt|gt|quot|amp|apos|#\d+|#x[0-9a-f]+);/gi, (_, e) => ({ lt: '<', gt: '>', quot: '"', amp: '&', apos: "'" }[e.toLowerCase()]
    ?? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))));
}

// UTF-16 code units as hex (big-endian), e.g. "0048 0069"
const utf16Encode = (s) => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i).toString(16).padStart(4, '0')).join(' ');
const utf16Decode = (s) => (s.replace(/0x|\\u/gi, ' ').match(/[0-9a-f]{4}/gi) || []).map((h) => String.fromCharCode(parseInt(h, 16))).join('');

const octalEncode = (bytes) => Array.from(bytes, (b) => b.toString(8).padStart(3, '0')).join(' ');
const octalDecode = (s) => new Uint8Array(s.replace(/\\/g, ' ').split(/[\s,]+/).filter(Boolean).map((o) => {
  const n = parseInt(o, 8);
  if (Number.isNaN(n) || n > 255 || /[89]/.test(o)) throw new Error(`Invalid octal byte "${o}"`);
  return n;
}));

// Charcode list: String.fromCharCode(72,105)
const charcodeEncode = (s) => Array.from(s, (c) => c.codePointAt(0)).join(',');
const charcodeDecode = (s) => (s.match(/\d+/g) || []).map((n) => String.fromCodePoint(Number(n))).join('');

/* Byte codec helper: string → bytes(UTF-8) → encoded string, and back. */
const bytesCodec = (enc, dec) => ({
  encode: (s) => enc(utf8Encode(s)),
  decode: (s) => bytesToText(dec(s)),
});

/**
 * All codecs. `test` is a cheap format check used by the Magic Decoder to decide what to try.
 * `group` drives the grouping in the UI.
 */
export const CODECS = [
  { id: 'base64', label: 'Base64', group: 'Base encodings', ...bytesCodec(bytesToBase64, base64ToBytes), test: (s) => /^[A-Za-z0-9+/\s]+={0,2}$/.test(s) && s.replace(/\s/g, '').length % 4 === 0 && s.length >= 4 },
  { id: 'base64url', label: 'Base64URL', group: 'Base encodings', ...bytesCodec(bytesToBase64Url, base64ToBytes), test: (s) => /^[A-Za-z0-9_-]+={0,2}$/.test(s) && /[-_]/.test(s) },
  { id: 'base32', label: 'Base32', group: 'Base encodings', ...bytesCodec(base32Encode, base32Decode), test: (s) => /^[A-Z2-7]+=*$/.test(s) && s.length % 8 === 0 },
  { id: 'base32hex', label: 'Base32 (no padding)', group: 'Base encodings', ...bytesCodec((b) => base32Encode(b, false), base32Decode) },
  { id: 'base36', label: 'Base36', group: 'Base encodings', ...bytesCodec((b) => baseNEncode(b, B36), (s) => baseNDecode(s.toLowerCase(), B36, 'Base36')) },
  { id: 'base45', label: 'Base45', group: 'Base encodings', ...bytesCodec(base45Encode, base45Decode), test: (s) => /^[0-9A-Z $%*+\-./:]+$/.test(s) && s.length % 3 !== 1 && /[A-Z]/.test(s) },
  { id: 'base58', label: 'Base58 (Bitcoin)', group: 'Base encodings', ...bytesCodec(base58Encode, base58Decode), test: (s) => /^[1-9A-HJ-NP-Za-km-z]+$/.test(s) && s.length >= 6 },
  { id: 'base62', label: 'Base62', group: 'Base encodings', ...bytesCodec((b) => baseNEncode(b, B62), (s) => baseNDecode(s, B62, 'Base62')), test: (s) => /^[0-9A-Za-z]+$/.test(s) && s.length >= 6 },
  { id: 'ascii85', label: 'Ascii85', group: 'Base encodings', ...bytesCodec(ascii85Encode, ascii85Decode), test: (s) => /^<~[\s\S]*~>$/.test(s.trim()) },
  { id: 'z85', label: 'Z85 (ZeroMQ)', group: 'Base encodings', ...bytesCodec(z85Encode, z85Decode) },
  { id: 'base91', label: 'Base91', group: 'Base encodings', ...bytesCodec(base91Encode, base91Decode) },

  { id: 'hex', label: 'Hex', group: 'Bytes & numbers', ...bytesCodec((b) => bytesToHex(b), hexToBytes), test: (s) => /^(0x)?[0-9a-f\s:]+$/i.test(s) && s.replace(/[\s:]|0x/gi, '').length % 2 === 0 && s.length >= 4 },
  { id: 'hex-escaped', label: 'Hex escaped (\\x41)', group: 'Bytes & numbers', ...bytesCodec((b) => Array.from(b, (x) => `\\x${x.toString(16).padStart(2, '0')}`).join(''), hexToBytes), test: (s) => /^(\\x[0-9a-f]{2})+$/i.test(s) },
  { id: 'binary', label: 'Binary', group: 'Bytes & numbers', ...bytesCodec(bytesToBinary, binaryToBytes), test: (s) => /^[01\s]+$/.test(s) && s.replace(/\s/g, '').length % 8 === 0 },
  { id: 'octal', label: 'Octal bytes', group: 'Bytes & numbers', ...bytesCodec(octalEncode, octalDecode), test: (s) => /^([0-3][0-7]{2}[\s,]*)+$/.test(s) },
  { id: 'decimal', label: 'Decimal bytes', group: 'Bytes & numbers', ...bytesCodec(bytesToDecimal, decimalToBytes), test: (s) => /^(\d{1,3}[\s,]+)+\d{1,3}$/.test(s) },
  { id: 'charcode', label: 'Char codes (fromCharCode)', group: 'Bytes & numbers', encode: charcodeEncode, decode: charcodeDecode, test: (s) => /^(String\.fromCharCode\()?(\d+\s*,\s*)+\d+\)?$/.test(s) },
  { id: 'utf16', label: 'UTF-16 code units', group: 'Bytes & numbers', encode: utf16Encode, decode: utf16Decode },

  { id: 'url', label: 'URL (percent)', group: 'Web', encode: encodeURIComponent, decode: (s) => decodeURIComponent(s.replace(/\+/g, ' ')), test: (s) => /%[0-9a-f]{2}/i.test(s) },
  { id: 'url-all', label: 'URL (every byte)', group: 'Web', encode: (s) => Array.from(utf8Encode(s), (b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join(''), decode: (s) => decodeURIComponent(s) },
  { id: 'html', label: 'HTML entities', group: 'Web', encode: (s) => s.replace(/[&<>"']/g, (c) => HTML_NAMED[c]), decode: htmlDecode, test: (s) => /&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(s) },
  { id: 'html-dec', label: 'HTML decimal entities (&#…;)', group: 'Web', encode: (s) => Array.from(s, (c) => `&#${c.codePointAt(0)};`).join(''), decode: htmlDecode },
  { id: 'html-hex', label: 'HTML hex entities (&#x…;)', group: 'Web', encode: (s) => Array.from(s, (c) => `&#x${c.codePointAt(0).toString(16)};`).join(''), decode: htmlDecode },
  { id: 'unicode', label: 'Unicode escape (\\uXXXX)', group: 'Web', encode: (s) => Array.from({ length: s.length }, (_, i) => `\\u${s.charCodeAt(i).toString(16).padStart(4, '0')}`).join(''), decode: (s) => s.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})/gi, (_, a, b) => String.fromCodePoint(parseInt(a || b, 16))), test: (s) => /\\u[0-9a-f]{4}/i.test(s) },
  { id: 'qp', label: 'Quoted-printable', group: 'Web', encode: qpEncode, decode: qpDecode, test: (s) => /=[0-9A-F]{2}/.test(s) },
  { id: 'punycode', label: 'Punycode (IDN)', group: 'Web', encode: punyEncode, decode: punyDecode, test: (s) => /(^|\.)xn--/i.test(s) },
  { id: 'uuencode', label: 'UUencode', group: 'Web', ...bytesCodec(uuEncode, uuDecode), test: (s) => /^begin \d{3} /m.test(s) },

  { id: 'rot13', label: 'ROT13', group: 'Ciphers & fun', encode: (s) => shift(s, 13), decode: (s) => shift(s, 13) },
  { id: 'rot18', label: 'ROT18 (letters+digits)', group: 'Ciphers & fun', encode: rot18, decode: rot18 },
  { id: 'rot47', label: 'ROT47', group: 'Ciphers & fun', encode: rot47, decode: rot47 },
  { id: 'atbash', label: 'Atbash', group: 'Ciphers & fun', encode: (s) => s.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(b + 25 - (c.charCodeAt(0) - b)); }), decode: (s) => s.replace(/[a-z]/gi, (c) => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(b + 25 - (c.charCodeAt(0) - b)); }) },
  { id: 'morse', label: 'Morse code', group: 'Ciphers & fun', encode: (s) => s.toUpperCase().split(/\s+/).map((w) => [...w].map((c) => MORSE[c] || '').filter(Boolean).join(' ')).join(' / '), decode: (s) => s.trim().split(/\s*\/\s*|\s{3,}/).map((w) => w.split(/\s+/).map((c) => MORSE_REV[c] || '').join('')).join(' '), test: (s) => /^[.\-\s/]+$/.test(s) && /[.-]/.test(s) },
  { id: 'bacon', label: 'Baconian', group: 'Ciphers & fun', encode: baconEncode, decode: baconDecode, test: (s) => /^[AB\s]+$/i.test(s) && s.replace(/\s/g, '').length % 5 === 0 && s.length >= 5 },
  { id: 'tap', label: 'Tap code', group: 'Ciphers & fun', encode: tapEncode, decode: tapDecode },
  { id: 'a1z26', label: 'A1Z26', group: 'Ciphers & fun', encode: (s) => s.toUpperCase().split(/\s+/).map((w) => [...w].filter((c) => /[A-Z]/.test(c)).map((c) => c.charCodeAt(0) - 64).join('-')).join(' '), decode: (s) => s.split(/\s+/).map((w) => w.split(/[-,]/).filter(Boolean).map((n) => String.fromCharCode(64 + Number(n))).join('')).join(' '), test: (s) => /^(\d{1,2}[-,\s])+\d{1,2}$/.test(s) && s.split(/\D+/).every((n) => !n || (n >= 1 && n <= 26)) },
  { id: 'nato', label: 'NATO phonetic', group: 'Ciphers & fun', encode: (s) => [...s.toUpperCase()].map((c) => (/[A-Z]/.test(c) ? NATO[c.charCodeAt(0) - 65] : /[0-9]/.test(c) ? NATO_DIGITS[c] : c === ' ' ? '/' : c)).join(' '), decode: (s) => s.split(/\s+/).map((w) => { if (w === '/') return ' '; const i = NATO.findIndex((n) => n.toLowerCase() === w.toLowerCase().replace('xray', 'x-ray')); if (i >= 0) return String.fromCharCode(65 + i); const d = NATO_DIGITS.findIndex((n) => n.toLowerCase() === w.toLowerCase()); return d >= 0 ? String(d) : w; }).join('') },
  { id: 'braille', label: 'Braille', group: 'Ciphers & fun', encode: brailleEncode, decode: brailleDecode, test: (s) => /[⠀-⣿]/.test(s) },
  { id: 'leet', label: 'Leetspeak', group: 'Ciphers & fun', encode: (s) => s.replace(/[abegilostz]/gi, (c) => LEET[c.toLowerCase()]), decode: (s) => s.replace(/[483610572@$]/g, (c) => LEET_REV[c] ?? c) },
  { id: 'reverse', label: 'Reverse', group: 'Ciphers & fun', encode: (s) => Array.from(s).reverse().join(''), decode: (s) => Array.from(s).reverse().join('') },
];

export const CODEC_MAP = Object.fromEntries(CODECS.map((c) => [c.id, c]));
export const CODEC_GROUPS = [...new Set(CODECS.map((c) => c.group))];

/** Share of printable characters in a string (0–1). */
export function printableRatio(s) {
  if (!s) return 0;
  let ok = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if ((c >= 32 && c < 127) || c === 9 || c === 10 || c === 13 || (c >= 0xc0 && c !== 0xfffd && c !== 0xd7 && c !== 0xf7)) ok++;
  }
  return ok / [...s].length;
}

const COMMON = /\b(the|and|flag|ctf|you|that|this|with|have|for|not|are|http|password|admin|user|key|secret|hello|from|is|of|to|in)\b/gi;

/** Rough "does this look like a meaningful result" score. */
export function plaintextScore(s) {
  if (!s) return 0;
  const pr = printableRatio(s);
  const words = (s.match(COMMON) || []).length;
  const letters = (s.match(/[a-z ]/gi) || []).length / s.length;
  const structured = /^[[{]/.test(s.trim()) || /^https?:\/\//.test(s) || /flag\{|ctf\{|\w+\{[^}]+\}/i.test(s) ? 0.5 : 0;
  return pr * 2 + letters + Math.min(words, 5) * 0.3 + structured;
}

/**
 * Magic: breadth-first search over codecs whose `test` matches, keeping the most plausible chains.
 * Returns [{ chain: [codecId…], output, score }] sorted best first.
 */
export function magicDecode(input, { depth = 4, max = 12, extra = [] } = {}) {
  const start = input.trim();
  const results = [];
  const seen = new Set([start]);
  let frontier = [{ chain: [], output: start }];
  const tryable = CODECS.filter((c) => c.test);
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const node of frontier) {
      for (const codec of [...tryable, ...extra]) {
        const s = node.output.trim();
        if (s.length > 200000) continue;
        if (codec.test && !codec.test(s)) continue;
        let out;
        try { out = codec.decode(s); } catch { continue; }
        if (!out || out === s || seen.has(out)) continue;
        if (printableRatio(out) < 0.85) continue;
        seen.add(out);
        const item = { chain: [...node.chain, codec.id], output: out, score: plaintextScore(out) - d * 0.05 };
        results.push(item);
        next.push(item);
        // A trailing letter cipher is common in CTFs: keep it when it clearly reads better.
        for (const id of ['rot13', 'atbash', 'reverse']) {
          const alt = CODEC_MAP[id].decode(out);
          const sc = plaintextScore(alt) - d * 0.05;
          if (!seen.has(alt) && sc > item.score + 0.3) { seen.add(alt); results.push({ chain: [...item.chain, id], output: alt, score: sc }); }
        }
      }
    }
    if (!next.length) break;
    frontier = next.sort((a, b) => b.score - a.score).slice(0, 8);
  }
  return results.sort((a, b) => b.score - a.score).slice(0, max);
}

