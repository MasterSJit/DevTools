// Minimal DER/ASN.1 parser and X.509 / PKCS#10 decoder — enough to inspect certificates offline.
import { bytesToHex, latin1Decode, utf8Decode } from './encoding';

export function parseDer(bytes, pos = 0) {
  const start = pos;
  const tag = bytes[pos++];
  if (tag === undefined) throw new Error('Unexpected end of DER data');
  const cls = tag >> 6;
  const constructed = !!(tag & 0x20);
  let tagNum = tag & 0x1f;
  if (tagNum === 0x1f) {
    tagNum = 0;
    let t;
    do { t = bytes[pos++]; tagNum = (tagNum << 7) | (t & 0x7f); } while (t & 0x80);
  }
  let len = bytes[pos++];
  if (len === 0x80) throw new Error('Indefinite-length encoding is not valid DER');
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + bytes[pos++];
  }
  const end = pos + len;
  if (end > bytes.length) throw new Error('Truncated DER data');
  const node = { tag, cls, constructed, tagNum, start, contentStart: pos, end, value: bytes.subarray(pos, end) };
  if (constructed) {
    node.children = [];
    let p = pos;
    while (p < end) { const child = parseDer(bytes, p); node.children.push(child); p = child.end; }
  }
  return node;
}

export function decodeOid(value) {
  const parts = [];
  let n = 0;
  for (let i = 0; i < value.length; i++) {
    n = n * 128 + (value[i] & 0x7f);
    if (!(value[i] & 0x80)) { parts.push(n); n = 0; }
  }
  const first = parts.shift();
  const a = first < 80 ? Math.floor(first / 40) : 2;
  return [a, first - a * 40, ...parts].join('.');
}

export const OIDS = {
  '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.9': 'street', '2.5.4.10': 'O',
  '2.5.4.11': 'OU', '2.5.4.5': 'serialNumber', '2.5.4.12': 'title', '2.5.4.42': 'GN', '2.5.4.4': 'SN',
  '2.5.4.97': 'organizationIdentifier', '1.2.840.113549.1.9.1': 'emailAddress', '0.9.2342.19200300.100.1.25': 'DC',
  '1.3.6.1.4.1.311.60.2.1.3': 'jurisdictionC', '2.5.4.15': 'businessCategory',
  // algorithms
  '1.2.840.113549.1.1.1': 'RSA', '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption', '1.2.840.113549.1.1.4': 'md5WithRSAEncryption',
  '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption', '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption', '1.2.840.113549.1.1.10': 'RSASSA-PSS',
  '1.2.840.10045.2.1': 'EC', '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256', '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
  '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512', '1.2.840.10045.4.1': 'ecdsa-with-SHA1', '1.3.101.112': 'Ed25519', '1.3.101.113': 'Ed448',
  '1.2.840.10045.3.1.7': 'P-256', '1.3.132.0.34': 'P-384', '1.3.132.0.35': 'P-521', '1.3.132.0.10': 'secp256k1',
  // extensions
  '2.5.29.14': 'Subject Key Identifier', '2.5.29.15': 'Key Usage', '2.5.29.17': 'Subject Alternative Name',
  '2.5.29.19': 'Basic Constraints', '2.5.29.31': 'CRL Distribution Points', '2.5.29.32': 'Certificate Policies',
  '2.5.29.35': 'Authority Key Identifier', '2.5.29.37': 'Extended Key Usage', '1.3.6.1.5.5.7.1.1': 'Authority Info Access',
  '1.3.6.1.4.1.11129.2.4.2': 'Signed Certificate Timestamps', '1.3.6.1.5.5.7.1.24': 'TLS Feature (OCSP Must-Staple)',
  '2.5.29.30': 'Name Constraints', '1.3.6.1.4.1.311.21.7': 'MS Certificate Template',
  // EKU
  '1.3.6.1.5.5.7.3.1': 'TLS Web Server Authentication', '1.3.6.1.5.5.7.3.2': 'TLS Web Client Authentication',
  '1.3.6.1.5.5.7.3.3': 'Code Signing', '1.3.6.1.5.5.7.3.4': 'E-mail Protection', '1.3.6.1.5.5.7.3.8': 'Time Stamping',
  '1.3.6.1.5.5.7.3.9': 'OCSP Signing', '1.3.6.1.5.5.7.48.1': 'OCSP', '1.3.6.1.5.5.7.48.2': 'CA Issuers',
  // policies
  '2.23.140.1.2.1': 'Domain Validated (DV)', '2.23.140.1.2.2': 'Organization Validated (OV)', '2.23.140.1.1': 'Extended Validation (EV)',
  '2.23.140.1.2.3': 'Individual Validated (IV)',
};

const oidName = (oid) => OIDS[oid] || oid;

function decodeString(node) {
  switch (node.tagNum) {
    case 0x0c: return utf8Decode(node.value);                 // UTF8String
    case 0x1e: {                                               // BMPString (UTF-16BE)
      let s = '';
      for (let i = 0; i + 1 < node.value.length; i += 2) s += String.fromCharCode((node.value[i] << 8) | node.value[i + 1]);
      return s;
    }
    default: return latin1Decode(node.value);                 // Printable, IA5, T61, Visible…
  }
}

function decodeTime(node) {
  const s = latin1Decode(node.value);
  let y, rest;
  if (node.tagNum === 0x17) { // UTCTime YYMMDDHHMMSSZ
    const yy = parseInt(s.slice(0, 2), 10);
    y = yy >= 50 ? 1900 + yy : 2000 + yy;
    rest = s.slice(2);
  } else { y = parseInt(s.slice(0, 4), 10); rest = s.slice(4); }
  const [mo, d, h, mi, se] = [0, 2, 4, 6, 8].map((i) => parseInt(rest.slice(i, i + 2) || '0', 10));
  return new Date(Date.UTC(y, mo - 1, d, h, mi, se));
}

function decodeName(node) {
  const parts = [];
  for (const rdn of node.children || []) {
    for (const atv of rdn.children || []) {
      const [oidNode, valNode] = atv.children;
      parts.push({ key: oidName(decodeOid(oidNode.value)), value: decodeString(valNode) });
    }
  }
  return { parts, text: parts.map((p) => `${p.key}=${p.value}`).join(', '), get: (k) => parts.find((p) => p.key === k)?.value };
}

function integerHex(node) {
  let v = node.value;
  while (v.length > 1 && v[0] === 0) v = v.subarray(1);
  return bytesToHex(v, ':').toUpperCase();
}

function decodeAlgId(node) {
  const oid = decodeOid(node.children[0].value);
  const params = node.children[1];
  return { oid, name: oidName(oid), paramOid: params && params.tagNum === 6 ? decodeOid(params.value) : null };
}

export function decodeSpki(node) {
  const alg = decodeAlgId(node.children[0]);
  const bitString = node.children[1].value.subarray(1); // skip unused-bits byte
  const info = { algorithm: alg.name, curve: alg.paramOid ? oidName(alg.paramOid) : null, bits: null };
  if (alg.name === 'RSA') {
    const rsa = parseDer(bitString);
    let mod = rsa.children[0].value;
    while (mod.length && mod[0] === 0) mod = mod.subarray(1);
    info.bits = mod.length * 8 - Math.clz32(mod[0]) + 24;
    info.exponent = parseInt(bytesToHex(rsa.children[1].value), 16);
  } else if (alg.name === 'EC') {
    info.bits = { 'P-256': 256, 'P-384': 384, 'P-521': 521, secp256k1: 256 }[info.curve] || null;
  } else if (alg.name === 'Ed25519') info.bits = 256;
  return info;
}

const KEY_USAGE = ['Digital Signature', 'Non Repudiation', 'Key Encipherment', 'Data Encipherment', 'Key Agreement', 'Certificate Sign', 'CRL Sign', 'Encipher Only', 'Decipher Only'];

function generalNames(node) {
  const out = [];
  for (const gn of node.children || []) {
    if (gn.cls !== 2) continue;
    const t = gn.tagNum;
    if (t === 2) out.push({ type: 'DNS', value: latin1Decode(gn.value) });
    else if (t === 1) out.push({ type: 'Email', value: latin1Decode(gn.value) });
    else if (t === 6) out.push({ type: 'URI', value: latin1Decode(gn.value) });
    else if (t === 7) {
      const v = gn.value;
      out.push({ type: 'IP', value: v.length === 4 ? Array.from(v).join('.') : bytesToHex(v).match(/.{4}/g).join(':') });
    } else if (t === 4 && gn.children?.[0]) out.push({ type: 'DirName', value: decodeName(gn.children[0]).text });
  }
  return out;
}

function decodeExtension(oid, der) {
  const node = parseDer(der);
  switch (oid) {
    case '2.5.29.17': return { san: generalNames(node), text: generalNames(node).map((g) => `${g.type}:${g.value}`).join(', ') };
    case '2.5.29.19': {
      const ca = node.children?.find((c) => c.tagNum === 1);
      const pl = node.children?.find((c) => c.tagNum === 2);
      const isCa = !!(ca && ca.value[0]);
      return { isCa, text: `CA: ${isCa ? 'TRUE' : 'FALSE'}${pl ? `, pathLen: ${parseInt(bytesToHex(pl.value), 16)}` : ''}` };
    }
    case '2.5.29.15': {
      const unused = node.value[0];
      let bits = 0;
      for (let i = 1; i < node.value.length; i++) bits = (bits << 8) | node.value[i];
      const total = (node.value.length - 1) * 8 - unused;
      const names = KEY_USAGE.filter((_, i) => i < total && (bits >> ((node.value.length - 1) * 8 - 1 - i)) & 1);
      return { text: names.join(', ') };
    }
    case '2.5.29.37': return { text: node.children.map((c) => oidName(decodeOid(c.value))).join(', ') };
    case '2.5.29.14': return { text: bytesToHex(node.value, ':').toUpperCase() };
    case '2.5.29.35': {
      const kid = node.children?.find((c) => c.cls === 2 && c.tagNum === 0);
      return { text: kid ? bytesToHex(kid.value, ':').toUpperCase() : '(no key id)' };
    }
    case '1.3.6.1.5.5.7.1.1':
      return { text: node.children.map((ad) => `${oidName(decodeOid(ad.children[0].value))}: ${generalNames({ children: [ad.children[1]] })[0]?.value || ''}`).join('\n') };
    case '2.5.29.31': {
      const uris = [];
      const walk = (n) => { if (n.cls === 2 && n.tagNum === 6 && !n.constructed) uris.push(latin1Decode(n.value)); n.children?.forEach(walk); };
      walk(node);
      return { text: uris.join('\n') };
    }
    case '2.5.29.32': return { text: node.children.map((p) => oidName(decodeOid(p.children[0].value))).join(', ') };
    case '1.3.6.1.4.1.11129.2.4.2': return { text: 'Present (certificate was logged to Certificate Transparency)' };
    default: return { text: `${der.length} bytes` };
  }
}

function decodeExtensions(container) {
  const seq = container?.children?.[0];
  if (!seq) return [];
  return seq.children.map((ext) => {
    const oid = decodeOid(ext.children[0].value);
    const critical = ext.children.length === 3 && !!ext.children[1].value[0];
    const valueNode = ext.children[ext.children.length - 1];
    let decoded;
    try { decoded = decodeExtension(oid, valueNode.value); } catch { decoded = { text: '(could not decode)' }; }
    return { oid, name: oidName(oid), critical, ...decoded };
  });
}

/** Decodes an X.509 certificate from DER bytes. */
export function decodeCertificate(der) {
  const root = parseDer(der);
  const [tbs, sigAlg] = root.children;
  let i = 0;
  let version = 1;
  if (tbs.children[0].cls === 2 && tbs.children[0].tagNum === 0) {
    version = tbs.children[0].children[0].value[0] + 1;
    i = 1;
  }
  const serial = integerHex(tbs.children[i]);
  const issuer = decodeName(tbs.children[i + 2]);
  const validity = tbs.children[i + 3];
  const subject = decodeName(tbs.children[i + 4]);
  const publicKey = decodeSpki(tbs.children[i + 5]);
  const extContainer = tbs.children.slice(i + 6).find((c) => c.cls === 2 && c.tagNum === 3);
  const extensions = decodeExtensions(extContainer);
  return {
    type: 'certificate',
    version,
    serial,
    signatureAlgorithm: decodeAlgId(sigAlg).name,
    issuer,
    subject,
    notBefore: decodeTime(validity.children[0]),
    notAfter: decodeTime(validity.children[1]),
    publicKey,
    extensions,
    san: extensions.find((e) => e.oid === '2.5.29.17')?.san || [],
    isCa: extensions.find((e) => e.oid === '2.5.29.19')?.isCa || false,
  };
}

/** Decodes a PKCS#10 certificate signing request from DER bytes. */
export function decodeCsr(der) {
  const root = parseDer(der);
  const [info, sigAlg] = root.children;
  const subject = decodeName(info.children[1]);
  const publicKey = decodeSpki(info.children[2]);
  let extensions = [];
  const attrs = info.children[3];
  for (const attr of attrs?.children || []) {
    if (decodeOid(attr.children[0].value) === '1.2.840.113549.1.9.14') extensions = decodeExtensions({ children: [attr.children[1].children[0]] });
  }
  return {
    type: 'csr',
    subject,
    publicKey,
    signatureAlgorithm: decodeAlgId(sigAlg).name,
    extensions,
    san: extensions.find((e) => e.oid === '2.5.29.17')?.san || [],
  };
}
