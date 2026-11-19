// Apache htpasswd hash formats: APR1-MD5 ($apr1$), SHA-1 ({SHA}) and bcrypt ($2y$).
import { md5 } from '@/shared/lib/crypto';
import { utf8Encode, bytesToBase64 } from '@/shared/lib/encoding';

const ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const to64 = (v, n) => { let s = ''; while (n-- > 0) { s += ITOA64[v & 0x3f]; v >>>= 6; } return s; };

/** md5crypt as used by Apache ($apr1$) — identical to `openssl passwd -apr1`. */
export function apr1(password, salt) {
  const P = utf8Encode(password);
  const S = utf8Encode(salt.slice(0, 8));
  const M = utf8Encode('$apr1$');
  let fin = md5(cat(P, S, P));
  const parts = [P, M, S];
  for (let pl = P.length; pl > 0; pl -= 16) parts.push(fin.subarray(0, Math.min(16, pl)));
  for (let i = P.length; i; i >>= 1) parts.push(i & 1 ? new Uint8Array([0]) : P.subarray(0, 1));
  fin = md5(cat(...parts));
  for (let i = 0; i < 1000; i++) {
    const c = [i & 1 ? P : fin];
    if (i % 3) c.push(S);
    if (i % 7) c.push(P);
    c.push(i & 1 ? fin : P);
    fin = md5(cat(...c));
  }
  const f = fin;
  const out = to64((f[0] << 16) | (f[6] << 8) | f[12], 4) + to64((f[1] << 16) | (f[7] << 8) | f[13], 4)
    + to64((f[2] << 16) | (f[8] << 8) | f[14], 4) + to64((f[3] << 16) | (f[9] << 8) | f[15], 4)
    + to64((f[4] << 16) | (f[10] << 8) | f[5], 4) + to64(f[11], 2);
  return `$apr1$${salt.slice(0, 8)}$${out}`;
}

export async function sha1Htpasswd(password) {
  return `{SHA}${bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-1', utf8Encode(password))))}`;
}

export function randomSalt(n = 8) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => ITOA64[x & 63]).join('');
}

/** Constant-time-ish string compare (avoid early exit on first differing char). */
export function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
