// Crypto helpers built on the Web Crypto API (plus small pure-JS MD5 / CRC32 where the platform has none).
import { utf8Encode, concatBytes, bytesToBase64 } from './encoding';

export const toBytes = (data) => (typeof data === 'string' ? utf8Encode(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : data);

export function randomBytes(n) {
  const out = new Uint8Array(n);
  // getRandomValues is limited to 65536 bytes per call
  for (let i = 0; i < n; i += 65536) crypto.getRandomValues(out.subarray(i, Math.min(n, i + 65536)));
  return out;
}

/** Unbiased random integer in [0, max) using rejection sampling. */
export function randomInt(max) {
  if (max <= 0) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return buf[0] % max;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ── MD5 (RFC 1321) — Web Crypto doesn't offer it, but it's still everywhere for checksums ──
const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) | 0);

export function md5(data) {
  const bytes = toBytes(data);
  const len = bytes.length;
  const nBlocks = ((len + 8) >>> 6) + 1;
  const words = new Int32Array(nBlocks * 16);
  for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  words[len >> 2] |= 0x80 << ((len % 4) * 8);
  words[nBlocks * 16 - 2] = (len * 8) >>> 0;
  words[nBlocks * 16 - 1] = Math.floor(len / 0x20000000);

  let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
  for (let blk = 0; blk < words.length; blk += 16) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      const s = MD5_S[(i >> 4) * 4 + (i % 4)];
      F = (F + A + MD5_K[i] + words[blk + g]) | 0;
      A = D; D = C; C = B;
      B = (B + ((F << s) | (F >>> (32 - s)))) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  const out = new Uint8Array(16);
  [a0, b0, c0, d0].forEach((v, i) => { for (let j = 0; j < 4; j++) out[i * 4 + j] = (v >>> (j * 8)) & 0xff; });
  return out;
}

// ── CRC32 (IEEE) ──
let CRC_TABLE;
export function crc32(data) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  const bytes = toBytes(data);
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  const v = (crc ^ 0xffffffff) >>> 0;
  return new Uint8Array([(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]);
}

export const HASH_ALGOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512', 'CRC32'];

/** Returns the digest bytes for any algorithm in HASH_ALGOS. */
export async function digest(algo, data) {
  const bytes = toBytes(data);
  if (algo === 'MD5') return md5(bytes);
  if (algo === 'CRC32') return crc32(bytes);
  return new Uint8Array(await crypto.subtle.digest(algo, bytes));
}

/** HMAC for SHA-* via Web Crypto, MD5 implemented by hand (block size 64). */
export async function hmac(algo, key, data) {
  const k = toBytes(key), d = toBytes(data);
  if (algo === 'MD5') {
    let kk = k.length > 64 ? md5(k) : k;
    const padded = new Uint8Array(64); padded.set(kk);
    const ipad = padded.map((b) => b ^ 0x36), opad = padded.map((b) => b ^ 0x5c);
    return md5(concatBytes(opad, md5(concatBytes(ipad, d))));
  }
  const cryptoKey = await crypto.subtle.importKey('raw', k.length ? k : new Uint8Array(1), { name: 'HMAC', hash: algo }, false, ['sign']);
  if (!k.length) {
    // Web Crypto rejects empty keys; an empty HMAC key is equivalent to a block of zeros.
    const zero = await crypto.subtle.importKey('raw', new Uint8Array(algo === 'SHA-384' || algo === 'SHA-512' ? 128 : 64), { name: 'HMAC', hash: algo }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', zero, d));
  }
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, d));
}

/** Shannon entropy in bits per byte (0 – 8). */
export function shannonEntropy(bytes) {
  if (!bytes.length) return 0;
  const freq = new Uint32Array(256);
  for (let i = 0; i < bytes.length; i++) freq[bytes[i]]++;
  let h = 0;
  for (const f of freq) { if (f) { const p = f / bytes.length; h -= p * Math.log2(p); } }
  return h;
}

export async function pbkdf2(password, salt, iterations, hash, lengthBytes) {
  const key = await crypto.subtle.importKey('raw', toBytes(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: toBytes(salt), iterations, hash }, key, lengthBytes * 8);
  return new Uint8Array(bits);
}

/** Wraps DER bytes in PEM armor. */
export function toPem(der, label) {
  const b64 = bytesToBase64(new Uint8Array(der));
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;
}

/** Extracts every PEM block from a text blob. */
export function parsePemBlocks(text) {
  const re = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g;
  const blocks = [];
  let m;
  while ((m = re.exec(text))) blocks.push({ label: m[1], b64: m[2].replace(/[^A-Za-z0-9+/=]/g, '') });
  return blocks;
}
