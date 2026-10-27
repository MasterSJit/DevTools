// Byte/text encoding helpers shared by the converter and security tools. All pure functions.

const enc = new TextEncoder();

export const utf8Encode = (str) => enc.encode(str);
export const utf8Decode = (bytes, fatal = false) => new TextDecoder('utf-8', { fatal }).decode(bytes);

/** Decodes as UTF-8 if valid, otherwise returns null. */
export function tryUtf8(bytes) {
  try { return utf8Decode(bytes, true); } catch { return null; }
}

export function latin1Encode(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

export function latin1Decode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return s;
}

export function concatBytes(...arrays) {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrays) { out.set(a, o); o += a.length; }
  return out;
}

// ── Hex ──
export function bytesToHex(bytes, sep = '') {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(sep);
}

export function hexToBytes(hex) {
  const clean = hex.replace(/0x/gi, '').replace(/[\s:,\-\\x]/g, '');
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('Invalid hex: only 0-9 and a-f are allowed');
  if (clean.length % 2) throw new Error('Invalid hex: odd number of digits');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

// ── Base64 / Base64URL ──
export function bytesToBase64(bytes) {
  return btoa(latin1Decode(bytes));
}

export function base64ToBytes(b64) {
  let s = b64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('Invalid Base64 input');
  s = s.replace(/=+$/, '');
  if (s.length % 4 === 1) throw new Error('Invalid Base64 length');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  return latin1Encode(atob(s));
}

export const bytesToBase64Url = (bytes) => bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const textToBase64 = (text) => bytesToBase64(utf8Encode(text));
export const base64ToText = (b64) => utf8Decode(base64ToBytes(b64));

// ── Base32 (RFC 4648) ──
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes, pad = true) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  if (pad) while (out.length % 8) out += '=';
  return out;
}

export function base32Decode(str) {
  const s = str.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of s) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid Base32 character "${ch}"`);
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}

// ── Base58 (Bitcoin alphabet) ──
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = '1' + out; }
  return out;
}

export function base58Decode(str) {
  const s = str.trim();
  let n = 0n;
  for (const ch of s) {
    const idx = B58.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid Base58 character "${ch}"`);
    n = n * 58n + BigInt(idx);
  }
  const out = [];
  while (n > 0n) { out.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const ch of s) { if (ch !== '1') break; out.unshift(0); }
  return new Uint8Array(out);
}

// ── Binary / decimal byte lists ──
export const bytesToBinary = (bytes) => Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join(' ');

export function binaryToBytes(str) {
  const clean = str.replace(/[^01]/g, '');
  if (clean.length % 8) throw new Error('Binary length must be a multiple of 8 bits');
  const out = new Uint8Array(clean.length / 8);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 8, 8), 2);
  return out;
}

export const bytesToDecimal = (bytes) => Array.from(bytes).join(' ');

export function decimalToBytes(str) {
  const nums = str.split(/[\s,]+/).filter(Boolean).map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) throw new Error('Decimal bytes must be integers 0-255');
  return new Uint8Array(nums);
}

/** Classic hexdump: offset | hex bytes | ASCII. */
export function hexdump(bytes, start = 0, width = 16) {
  const lines = [];
  for (let i = 0; i < bytes.length; i += width) {
    const chunk = bytes.subarray(i, i + width);
    const hex = Array.from(chunk, (b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(width * 3 - 1, ' ');
    const ascii = Array.from(chunk, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${(start + i).toString(16).padStart(8, '0')}  ${hex}  |${ascii}|`);
  }
  return lines.join('\n');
}

// ── Punycode (RFC 3492) decoding, used to reveal IDN homograph domains ──
export function punycodeDecode(input) {
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
  const output = [];
  let i = 0, n = 128, bias = 72;
  let basic = input.lastIndexOf('-');
  if (basic < 0) basic = 0;
  for (let j = 0; j < basic; j++) output.push(input.charCodeAt(j));
  const adapt = (delta, numPoints, first) => {
    let k = 0;
    delta = first ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    for (; delta > ((base - tMin) * tMax) >> 1; k += base) delta = Math.floor(delta / (base - tMin));
    return Math.floor(k + ((base - tMin + 1) * delta) / (delta + skew));
  };
  const digit = (c) => (c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base);
  for (let idx = basic > 0 ? basic + 1 : 0; idx < input.length;) {
    const oldi = i;
    for (let w = 1, k = base; ; k += base) {
      if (idx >= input.length) throw new Error('Bad punycode');
      const d = digit(input.charCodeAt(idx++));
      if (d >= base) throw new Error('Bad punycode');
      i += d * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (d < t) break;
      w *= base - t;
    }
    const len = output.length + 1;
    bias = adapt(i - oldi, len, oldi === 0);
    n += Math.floor(i / len);
    i %= len;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}

/** Converts an ASCII (xn--) hostname to its Unicode form. */
export function hostToUnicode(host) {
  return host.split('.').map((label) => {
    if (!label.toLowerCase().startsWith('xn--')) return label;
    try { return punycodeDecode(label.slice(4)); } catch { return label; }
  }).join('.');
}
