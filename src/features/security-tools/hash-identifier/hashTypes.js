// Hash format signatures. Ordered: specific prefixed formats first, then raw hex by length.
// `hc` = hashcat mode, `john` = John the Ripper format.

export const PREFIXED = [
  { re: /^\$2[abxy]?\$\d{2}\$[./A-Za-z0-9]{53}$/, name: 'bcrypt', hc: 3200, john: 'bcrypt' },
  { re: /^\$argon2(id|i|d)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/, name: 'Argon2', hc: 34000, john: 'argon2' },
  { re: /^\$scrypt\$|^SCRYPT:\d+:\d+:\d+:/, name: 'scrypt', hc: 8900, john: 'scrypt' },
  { re: /^\$y\$[./A-Za-z0-9]+\$[./A-Za-z0-9]+\$[./A-Za-z0-9]{43}$/, name: 'yescrypt (modern Linux /etc/shadow)', hc: null, john: 'crypt' },
  { re: /^\$6\$(rounds=\d+\$)?[./A-Za-z0-9]{1,16}\$[./A-Za-z0-9]{86}$/, name: 'sha512crypt (Linux $6$)', hc: 1800, john: 'sha512crypt' },
  { re: /^\$5\$(rounds=\d+\$)?[./A-Za-z0-9]{1,16}\$[./A-Za-z0-9]{43}$/, name: 'sha256crypt (Linux $5$)', hc: 7400, john: 'sha256crypt' },
  { re: /^\$1\$[./A-Za-z0-9]{0,8}\$[./A-Za-z0-9]{22}$/, name: 'md5crypt (Linux $1$ / Cisco)', hc: 500, john: 'md5crypt' },
  { re: /^\$apr1\$[./A-Za-z0-9]{0,8}\$[./A-Za-z0-9]{22}$/, name: 'Apache APR1 MD5 (htpasswd)', hc: 1600, john: 'md5crypt' },
  { re: /^\{SHA\}[A-Za-z0-9+/]{27}=$/, name: 'SHA-1 Base64 (htpasswd / LDAP {SHA})', hc: 101, john: 'nsldap' },
  { re: /^\{SSHA\}[A-Za-z0-9+/]+=*$/, name: 'Salted SHA-1 (LDAP {SSHA})', hc: 111, john: 'nsldaps' },
  { re: /^\{SSHA512\}[A-Za-z0-9+/]+=*$/, name: 'Salted SHA-512 (LDAP {SSHA512})', hc: 1711, john: 'ssha512' },
  { re: /^\$P\$[./A-Za-z0-9]{31}$/, name: 'phpass (WordPress)', hc: 400, john: 'phpass' },
  { re: /^\$H\$[./A-Za-z0-9]{31}$/, name: 'phpass (phpBB3)', hc: 400, john: 'phpass' },
  { re: /^\$S\$[./A-Za-z0-9]{52}$/, name: 'Drupal 7 (SHA-512)', hc: 7900, john: 'drupal7' },
  { re: /^pbkdf2_sha256\$\d+\$[^$]+\$[A-Za-z0-9+/]+=*$/, name: 'Django PBKDF2-SHA256', hc: 10000, john: 'django' },
  { re: /^pbkdf2:sha256:\d+\$[^$]+\$[0-9a-f]{64}$/, name: 'Werkzeug / Flask PBKDF2-SHA256', hc: null, john: null },
  { re: /^sha1\$[^$]+\$[0-9a-f]{40}$/, name: 'Django SHA-1 (legacy)', hc: 124, john: null },
  { re: /^\$pbkdf2-sha(1|256|512)\$\d+\$[./A-Za-z0-9]+\$[./A-Za-z0-9]+$/, name: 'Passlib PBKDF2', hc: 20200, john: 'pbkdf2-hmac-sha256' },
  { re: /^\$krb5tgs\$23\$/, name: 'Kerberos 5 TGS-REP etype 23 (Kerberoasting)', hc: 13100, john: 'krb5tgs' },
  { re: /^\$krb5asrep\$23\$/, name: 'Kerberos 5 AS-REP etype 23 (AS-REP roasting)', hc: 18200, john: 'krb5asrep' },
  { re: /^[^:]+::[^:]+:[0-9a-f]{16}:[0-9a-f]{32}:[0-9a-f]+$/i, name: 'NetNTLMv2', hc: 5600, john: 'netntlmv2' },
  { re: /^[^:]+::[^:]+:[0-9a-f]{48}:[0-9a-f]{48}:[0-9a-f]{16}$/i, name: 'NetNTLMv1', hc: 5500, john: 'netntlm' },
  { re: /^[^:]+:\d+:[0-9a-f]{32}:[0-9a-f]{32}:::$/i, name: 'Windows SAM / pwdump (LM:NTLM)', hc: 1000, john: 'nt' },
  { re: /^\$DCC2\$\d+#[^#]+#[0-9a-f]{32}$/i, name: 'Domain Cached Credentials 2 (MS Cache v2)', hc: 2100, john: 'mscash2' },
  { re: /^0x0100[0-9a-f]{48}$/i, name: 'MSSQL 2005', hc: 132, john: 'mssql05' },
  { re: /^0x0200[0-9a-f]{136}$/i, name: 'MSSQL 2012+', hc: 1731, john: 'mssql12' },
  { re: /^\*[0-9A-F]{40}$/, name: 'MySQL 4.1+ (mysql_native_password)', hc: 300, john: 'mysql-sha1' },
  { re: /^md5[0-9a-f]{32}$/, name: 'PostgreSQL MD5', hc: 12, john: 'postgres' },
  { re: /^SCRAM-SHA-256\$\d+:/, name: 'PostgreSQL SCRAM-SHA-256', hc: 28600, john: null },
  { re: /^\$9\$[./A-Za-z0-9]{14}\$[./A-Za-z0-9]{43}$/, name: 'Cisco Type 9 (scrypt)', hc: 9300, john: 'cisco9' },
  { re: /^\$8\$[./A-Za-z0-9]{14}\$[./A-Za-z0-9]{43}$/, name: 'Cisco Type 8 (PBKDF2-SHA256)', hc: 9200, john: 'cisco8' },
  { re: /^\d{2}[0-9A-F]{6,}$/, name: 'Cisco Type 7 (reversible XOR, not a hash!)', hc: null, john: null, weak: true, test: (s) => /^\d{2}[0-9A-F]{6,}$/.test(s) && s.length % 2 === 0 && Number(s.slice(0, 2)) <= 15 },
  { re: /^\$zip2\$/, name: 'WinZip AES', hc: 13600, john: 'zip' },
  { re: /^\$pkzip2?\$/, name: 'PKZIP', hc: 17200, john: 'pkzip' },
  { re: /^\$office\$\*20(07|10|13)\*/, name: 'MS Office 2007+', hc: 9600, john: 'office' },
  { re: /^\$pdf\$/, name: 'PDF', hc: 10500, john: 'pdf' },
  { re: /^\$keepass\$\*/, name: 'KeePass', hc: 13400, john: 'keepass' },
  { re: /^\$7z\$/, name: '7-Zip', hc: 11600, john: '7z' },
  { re: /^\$rar5\$/, name: 'RAR5', hc: 13000, john: 'rar5' },
  { re: /^\$bitcoin\$/, name: 'Bitcoin / Litecoin wallet.dat', hc: 11300, john: 'bitcoin' },
  { re: /^\$ethereum\$/, name: 'Ethereum wallet', hc: 15700, john: 'ethereum' },
  { re: /^WPA\*0[12]\*/, name: 'WPA-PBKDF2-PMKID+EAPOL (hc22000)', hc: 22000, john: 'wpapsk' },
  { re: /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, name: 'JWT (HS256 secret can be brute-forced)', hc: 16500, john: 'HMAC-SHA256' },
];

// Raw hex digests grouped by length (characters).
export const BY_HEX_LENGTH = {
  8: [{ name: 'CRC32', hc: 11500 }, { name: 'Adler-32' }, { name: 'FNV-1 32' }],
  16: [{ name: 'MySQL 3.x (OLD_PASSWORD)', hc: 200, john: 'mysql' }, { name: 'Half MD5', hc: 5100 }, { name: 'CRC-64' }, { name: 'LM (half)', hc: 3000 }],
  32: [
    { name: 'MD5', hc: 0, john: 'raw-md5', common: true },
    { name: 'NTLM', hc: 1000, john: 'nt', common: true },
    { name: 'MD4', hc: 900, john: 'raw-md4' },
    { name: 'LM', hc: 3000, john: 'lm' },
    { name: 'md5(md5($pass))', hc: 2600 },
    { name: 'RIPEMD-128' }, { name: 'Tiger-128' }, { name: 'Haval-128' },
  ],
  40: [
    { name: 'SHA-1', hc: 100, john: 'raw-sha1', common: true },
    { name: 'MySQL 4.1+ (without *)', hc: 300, john: 'mysql-sha1' },
    { name: 'RIPEMD-160', hc: 6000, john: 'ripemd-160' },
    { name: 'sha1(sha1($pass))', hc: 4500 }, { name: 'Tiger-160' }, { name: 'Haval-160' },
  ],
  48: [{ name: 'Tiger-192', john: 'tiger' }, { name: 'Haval-192' }],
  56: [{ name: 'SHA-224', hc: 1300, john: 'raw-sha224', common: true }, { name: 'SHA3-224', hc: 17300 }, { name: 'Keccak-224', hc: 17700 }, { name: 'Haval-224' }],
  64: [
    { name: 'SHA-256', hc: 1400, john: 'raw-sha256', common: true },
    { name: 'SHA3-256', hc: 17400, john: 'raw-sha3' },
    { name: 'Keccak-256 (Ethereum)', hc: 17800, john: 'raw-keccak-256' },
    { name: 'BLAKE2s-256' }, { name: 'RIPEMD-256' }, { name: 'GOST R 34.11-94', hc: 6900 }, { name: 'Snefru-256' }, { name: 'Haval-256' },
  ],
  80: [{ name: 'RIPEMD-320' }],
  96: [{ name: 'SHA-384', hc: 10800, john: 'raw-sha384', common: true }, { name: 'SHA3-384', hc: 17500 }, { name: 'Keccak-384', hc: 17900 }],
  128: [
    { name: 'SHA-512', hc: 1700, john: 'raw-sha512', common: true },
    { name: 'SHA3-512', hc: 17600 }, { name: 'Keccak-512', hc: 18000 }, { name: 'BLAKE2b-512', hc: 600, john: 'raw-blake2' },
    { name: 'Whirlpool', hc: 6100, john: 'whirlpool' }, { name: 'Salsa10/20' },
  ],
};

/** Identify a single hash string. Returns [{ name, hc, john, confidence, note }]. */
export function identifyHash(raw) {
  const s = raw.trim();
  if (!s) return [];
  const out = [];
  for (const p of PREFIXED) {
    if (p.test ? p.test(s) : p.re.test(s)) out.push({ ...p, confidence: p.test ? 'medium' : 'high' });
  }
  if (out.some((o) => o.confidence === 'high')) return out;

  // hash:salt forms
  const salted = s.match(/^([0-9a-f]+):(.+)$/i);
  const hex = (salted ? salted[1] : s);
  if (/^[0-9a-f]+$/i.test(hex) && BY_HEX_LENGTH[hex.length]) {
    for (const h of BY_HEX_LENGTH[hex.length]) {
      out.push({
        ...h,
        name: salted ? `${h.name} with salt ($pass.$salt / $salt.$pass)` : h.name,
        hc: salted && h.hc === 0 ? 10 : salted && h.hc === 100 ? 110 : salted && h.hc === 1400 ? 1410 : salted && h.hc === 1700 ? 1710 : h.hc,
        confidence: h.common ? 'high' : 'low',
      });
    }
  }
  // Base64-encoded raw digests
  if (!out.length && /^[A-Za-z0-9+/]+=*$/.test(s)) {
    const len = Math.floor((s.replace(/=+$/, '').length * 3) / 4);
    const map = { 16: 'MD5 / NTLM (Base64)', 20: 'SHA-1 (Base64)', 32: 'SHA-256 (Base64)', 48: 'SHA-384 (Base64)', 64: 'SHA-512 (Base64)' };
    if (map[len]) out.push({ name: map[len], confidence: 'medium', note: 'Decode the Base64 to hex first, then crack as the raw algorithm.' });
  }
  return out;
}
