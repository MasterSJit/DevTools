// File signatures ("magic bytes"). [name, hex bytes ('??' = any), offset, typical extensions, category]
const SIGS = [
  ['PNG image', '89504e470d0a1a0a', 0, ['png'], 'image'],
  ['JPEG image', 'ffd8ff', 0, ['jpg', 'jpeg', 'jfif'], 'image'],
  ['GIF image', '47494638', 0, ['gif'], 'image'],
  ['WebP image', '52494646????????57454250', 0, ['webp'], 'image'],
  ['BMP image', '424d', 0, ['bmp'], 'image'],
  ['TIFF image (LE)', '49492a00', 0, ['tif', 'tiff', 'dng', 'cr2', 'nef'], 'image'],
  ['TIFF image (BE)', '4d4d002a', 0, ['tif', 'tiff'], 'image'],
  ['ICO icon', '00000100', 0, ['ico'], 'image'],
  ['Photoshop PSD', '38425053', 0, ['psd'], 'image'],
  ['HEIC/AVIF image', '????????66747970', 0, ['heic', 'heif', 'avif', 'mp4', 'mov', 'm4a', '3gp'], 'media'],
  ['PDF document', '25504446', 0, ['pdf'], 'document'],
  ['ZIP archive (also DOCX/XLSX/PPTX/JAR/APK)', '504b0304', 0, ['zip', 'docx', 'xlsx', 'pptx', 'jar', 'apk', 'odt', 'epub', 'xpi', 'ipa'], 'archive'],
  ['ZIP (empty)', '504b0506', 0, ['zip'], 'archive'],
  ['RAR archive', '526172211a07', 0, ['rar'], 'archive'],
  ['7-Zip archive', '377abcaf271c', 0, ['7z'], 'archive'],
  ['GZIP', '1f8b', 0, ['gz', 'tgz'], 'archive'],
  ['BZIP2', '425a68', 0, ['bz2'], 'archive'],
  ['XZ', 'fd377a585a00', 0, ['xz'], 'archive'],
  ['Zstandard', '28b52ffd', 0, ['zst'], 'archive'],
  ['TAR archive', '7573746172', 257, ['tar'], 'archive'],
  ['Microsoft CAB', '4d534346', 0, ['cab'], 'archive'],
  ['ISO 9660 disk image', '4344303031', 32769, ['iso'], 'archive'],
  ['MS Office legacy / MSI (OLE2)', 'd0cf11e0a1b11ae1', 0, ['doc', 'xls', 'ppt', 'msi', 'msg'], 'document'],
  ['Rich Text Format', '7b5c72746631', 0, ['rtf'], 'document'],
  ['Windows executable (PE/MZ)', '4d5a', 0, ['exe', 'dll', 'sys', 'scr', 'cpl', 'ocx', 'com', 'efi'], 'executable'],
  ['ELF executable', '7f454c46', 0, ['', 'so', 'elf', 'bin', 'o'], 'executable'],
  ['Mach-O (64-bit)', 'cffaedfe', 0, ['', 'dylib'], 'executable'],
  ['Mach-O (32-bit)', 'cefaedfe', 0, ['', 'dylib'], 'executable'],
  ['Mach-O universal / Java class', 'cafebabe', 0, ['', 'class'], 'executable'],
  ['Android DEX', '6465780a', 0, ['dex'], 'executable'],
  ['WebAssembly', '0061736d', 0, ['wasm'], 'executable'],
  ['Windows shortcut (LNK)', '4c0000000114020000000000c000000000000046', 0, ['lnk'], 'executable'],
  ['Shell script / shebang', '2321', 0, ['sh', 'bash', 'py', 'pl', 'rb', ''], 'script'],
  ['SQLite database', '53514c69746520666f726d6174203300', 0, ['sqlite', 'db', 'sqlite3'], 'data'],
  ['MP3 audio (ID3)', '494433', 0, ['mp3'], 'media'],
  ['MP3 audio', 'fffb', 0, ['mp3'], 'media'],
  ['WAV audio', '52494646????????57415645', 0, ['wav'], 'media'],
  ['AVI video', '52494646????????41564920', 0, ['avi'], 'media'],
  ['OGG', '4f676753', 0, ['ogg', 'oga', 'ogv', 'opus'], 'media'],
  ['FLAC audio', '664c6143', 0, ['flac'], 'media'],
  ['Matroska / WebM', '1a45dfa3', 0, ['mkv', 'webm'], 'media'],
  ['WOFF font', '774f4646', 0, ['woff'], 'font'],
  ['WOFF2 font', '774f4632', 0, ['woff2'], 'font'],
  ['TrueType font', '0001000000', 0, ['ttf'], 'font'],
  ['OpenType font', '4f54544f', 0, ['otf'], 'font'],
  ['PEM text (key/certificate)', '2d2d2d2d2d424547494e', 0, ['pem', 'crt', 'key', 'cer', 'csr'], 'text'],
  ['XML document', '3c3f786d6c', 0, ['xml', 'svg', 'plist', 'xhtml'], 'text'],
  ['UTF-8 BOM text', 'efbbbf', 0, ['txt', 'csv', 'xml', 'html'], 'text'],
  ['PCAP capture', 'd4c3b2a1', 0, ['pcap'], 'data'],
  ['PCAPNG capture', '0a0d0d0a', 0, ['pcapng'], 'data'],
  ['Java KeyStore', 'feedfeed', 0, ['jks'], 'data'],
];

export function detectType(bytes) {
  const matches = [];
  for (const [name, hex, offset, exts, category] of SIGS) {
    const len = hex.length / 2;
    if (bytes.length < offset + len) continue;
    let ok = true;
    for (let i = 0; i < len; i++) {
      const pair = hex.substr(i * 2, 2);
      if (pair !== '??' && bytes[offset + i] !== parseInt(pair, 16)) { ok = false; break; }
    }
    if (ok) matches.push({ name, exts, category, magic: hex.replace(/\?\?/g, '..') });
  }
  if (!matches.length) {
    // Heuristic: mostly printable → text
    const sample = bytes.subarray(0, 4096);
    const printable = sample.filter((b) => (b >= 32 && b < 127) || b === 9 || b === 10 || b === 13).length;
    if (sample.length && printable / sample.length > 0.95) {
      const head = new TextDecoder().decode(sample).trimStart().toLowerCase();
      if (head.startsWith('<!doctype html') || head.startsWith('<html')) matches.push({ name: 'HTML document', exts: ['html', 'htm'], category: 'text' });
      else if (head.startsWith('{') || head.startsWith('[')) matches.push({ name: 'JSON / text', exts: ['json', 'txt'], category: 'text' });
      else matches.push({ name: 'Plain text', exts: ['txt', 'csv', 'log', 'md', 'js', 'css', 'ini', 'conf', 'yml', 'yaml'], category: 'text' });
    }
  }
  return matches;
}

const PE_MACHINES = { 0x14c: 'x86 (i386)', 0x8664: 'x86-64', 0x1c0: 'ARM', 0xaa64: 'ARM64', 0x200: 'IA-64' };
const PE_SUBSYSTEMS = { 1: 'Native', 2: 'Windows GUI', 3: 'Windows console', 9: 'Windows CE', 10: 'EFI application', 14: 'Xbox' };
const ELF_MACHINES = { 3: 'x86', 62: 'x86-64', 40: 'ARM', 183: 'AArch64', 243: 'RISC-V', 8: 'MIPS', 20: 'PowerPC' };
const ELF_TYPES = { 1: 'Relocatable', 2: 'Executable', 3: 'Shared object / PIE', 4: 'Core dump' };

/** Basic PE / ELF header facts — useful for a first look at unknown binaries. */
export function parseExecutable(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0x4d && bytes[1] === 0x5a && bytes.length > 0x40) {
    const pe = dv.getUint32(0x3c, true);
    if (pe + 24 > bytes.length || dv.getUint32(pe, true) !== 0x00004550) return { format: 'MZ (DOS stub only)' };
    const machine = dv.getUint16(pe + 4, true);
    const sections = dv.getUint16(pe + 6, true);
    const ts = dv.getUint32(pe + 8, true);
    const characteristics = dv.getUint16(pe + 22, true);
    const optMagic = dv.getUint16(pe + 24, true);
    const subsystem = pe + 24 + 68 + 2 <= bytes.length ? dv.getUint16(pe + 24 + 68, true) : null;
    return {
      format: optMagic === 0x20b ? 'PE32+ (64-bit)' : 'PE32',
      Machine: PE_MACHINES[machine] || `0x${machine.toString(16)}`,
      Type: characteristics & 0x2000 ? 'DLL' : 'Executable',
      Subsystem: PE_SUBSYSTEMS[subsystem] || subsystem,
      Sections: sections,
      'Compile timestamp': ts ? `${new Date(ts * 1000).toUTCString()} (can be forged)` : '0',
    };
  }
  if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46 && bytes.length > 20) {
    const le = bytes[5] === 1;
    return {
      format: bytes[4] === 2 ? 'ELF 64-bit' : 'ELF 32-bit',
      Endianness: le ? 'Little-endian' : 'Big-endian',
      Type: ELF_TYPES[dv.getUint16(16, le)] || dv.getUint16(16, le),
      Machine: ELF_MACHINES[dv.getUint16(18, le)] || dv.getUint16(18, le),
      'OS ABI': bytes[7] === 0 ? 'System V / Linux' : bytes[7] === 9 ? 'FreeBSD' : bytes[7],
    };
  }
  return null;
}

/** Extracts printable ASCII runs (like the Unix `strings` command). */
export function extractStrings(bytes, minLen = 5, limit = 3000) {
  const out = [];
  let cur = '';
  for (let i = 0; i < bytes.length && out.length < limit; i++) {
    const b = bytes[i];
    if (b >= 32 && b < 127) cur += String.fromCharCode(b);
    else { if (cur.length >= minLen) out.push(cur); cur = ''; }
  }
  if (cur.length >= minLen && out.length < limit) out.push(cur);
  return out;
}

const IOC_PATTERNS = [
  ['URL', /\bhttps?:\/\/[^\s"'<>]{4,}/gi],
  ['IPv4', /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g],
  ['Email', /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g],
  ['Windows path', /\b[A-Z]:\\[^\s"'<>|]{3,}/g],
  ['Registry key', /\b(?:HKEY_[A-Z_]+|HKLM|HKCU)\\[^\s"']{3,}/g],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g],
];

/** Finds indicators of compromise / interesting artefacts inside extracted strings. */
export function findIocs(strings) {
  const found = {};
  const joined = strings.join('\n');
  for (const [type, re] of IOC_PATTERNS) {
    const m = joined.match(re);
    if (m) found[type] = [...new Set(m)].slice(0, 100);
  }
  return found;
}
