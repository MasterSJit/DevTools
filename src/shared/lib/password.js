// Offline password strength estimation: charset entropy minus penalties for predictable patterns.

const COMMON = `123456 password 12345678 qwerty 123456789 12345 1234 111111 1234567 dragon 123123 baseball abc123 football
monkey letmein 696969 shadow master 666666 qwertyuiop 123321 mustang 1234567890 michael 654321 superman 1qaz2wsx
7777777 121212 000000 qazwsx 123qwe killer trustno1 jordan jennifer zxcvbnm asdfgh hunter buster soccer harley
batman andrew tigger sunshine iloveyou charlie robert thomas hockey ranger daniel starwars 112233 george computer
michelle jessica pepper 1111 zxcvbn 555555 11111111 131313 freedom 777777 pass maggie 159753 aaaaaa ginger princess
joshua cheese amanda summer love ashley nicole chelsea biteme matthew access yankees 987654321 dallas austin thunder
taylor matrix admin welcome login passw0rd changeme root toor secret guest default test test123 admin123 qwerty123
password1 password123 abc12345 iloveyou1 india123 hello world dog cat football1 monkey123 letmein123 welcome1
administrator system server oracle cisco ubuntu linux windows apple google samsung facebook instagram`.split(/\s+/);

const COMMON_SET = new Set(COMMON);

const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1qaz2wsx3edc', '!@#$%^&*()'];

const LEET = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', '$': 's', '5': 's', '7': 't', '+': 't' };

const unleet = (s) => s.toLowerCase().replace(/[@43!1057$+]/g, (c) => LEET[c] || c);

export function charsetSize(pw) {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9\s]/.test(pw) && /[\x20-\x7e]/.test(pw.replace(/[a-zA-Z0-9]/g, ''))) pool += 33;
  if (/\s/.test(pw)) pool += 1;
  if (/[^\x00-\x7f]/.test(pw)) pool += 100;
  return pool || 1;
}

function sequenceRuns(pw) {
  const lower = pw.toLowerCase();
  let count = 0;
  for (const seq of SEQUENCES) {
    const rev = [...seq].reverse().join('');
    for (const s of [seq, rev]) {
      for (let len = s.length; len >= 3; len--) {
        for (let i = 0; i + len <= s.length; i++) {
          if (lower.includes(s.slice(i, i + len))) { count += len; i = s.length; len = 0; }
        }
      }
    }
  }
  return count;
}

export function analyzePassword(pw) {
  const findings = [];
  if (!pw) return { entropy: 0, score: 0, findings };
  const pool = charsetSize(pw);
  let entropy = pw.length * Math.log2(pool);
  const lower = pw.toLowerCase();
  const normalized = unleet(pw);

  if (COMMON_SET.has(lower) || COMMON_SET.has(normalized)) {
    entropy = Math.min(entropy, 8);
    findings.push({ level: 'critical', title: 'Very common password', detail: 'This password appears in leaked-password top lists and is tried first by every attacker.' });
  } else {
    const word = COMMON.filter((w) => w.length >= 4 && normalized.includes(w)).sort((a, b) => b.length - a.length)[0];
    if (word) {
      entropy -= word.length * Math.log2(pool) - Math.log2(COMMON.length);
      findings.push({ level: 'medium', title: `Contains a common word/password (“${word}”)`, detail: 'Dictionary attacks with substitutions like @→a, 0→o find these quickly.' });
    }
  }

  const seq = sequenceRuns(pw);
  if (seq) {
    entropy -= seq * Math.log2(pool) * 0.8;
    findings.push({ level: 'medium', title: 'Keyboard or alphabetic sequence', detail: 'Runs like “abc”, “123” or “qwerty” add almost no strength.' });
  }

  const repeats = pw.match(/(.)\1{2,}/g);
  if (repeats) {
    entropy -= repeats.reduce((n, r) => n + r.length - 1, 0) * Math.log2(pool);
    findings.push({ level: 'low', title: 'Repeated characters', detail: `Found ${repeats.join(', ')}.` });
  }

  if (/(19|20)\d{2}/.test(pw)) {
    entropy -= 6;
    findings.push({ level: 'low', title: 'Looks like it contains a year', detail: 'Years and dates (birthdays, anniversaries) are common guesses.' });
  }

  if (/^[0-9]+$/.test(pw)) findings.push({ level: 'medium', title: 'Digits only', detail: 'Numeric passwords have a tiny search space.' });
  if (/^[a-zA-Z]+$/.test(pw)) findings.push({ level: 'low', title: 'Letters only', detail: 'Mix in digits or symbols — or just make it longer.' });
  if (/^[A-Z][a-z]+[0-9]{1,4}[!@#$]?$/.test(pw)) {
    entropy -= 8;
    findings.push({ level: 'medium', title: 'Predictable “Word123!” pattern', detail: 'Capital first letter + digits/symbol at the end is the most common human pattern.' });
  }
  if (pw.length < 8) findings.push({ level: 'high', title: 'Too short', detail: 'Use at least 12 characters (NIST SP 800-63B recommends allowing up to 64).' });
  else if (pw.length < 12) findings.push({ level: 'low', title: 'Could be longer', detail: 'Length is the single biggest factor — 14+ characters is a good target.' });

  entropy = Math.max(0, entropy);
  const score = entropy < 28 ? 0 : entropy < 36 ? 1 : entropy < 60 ? 2 : entropy < 80 ? 3 : 4;
  if (!findings.length) findings.push({ level: 'pass', title: 'No predictable patterns detected' });
  return { entropy, score, pool, findings };
}

export const SCORE_LABELS = [
  { label: 'Very weak', color: 'red' },
  { label: 'Weak', color: 'orange' },
  { label: 'Fair', color: 'yellow' },
  { label: 'Strong', color: 'lime' },
  { label: 'Very strong', color: 'teal' },
];

/** Attack scenarios (guesses per second) used for crack-time estimates. */
export const ATTACKS = [
  { label: 'Online, rate-limited', rate: 100 / 3600 },
  { label: 'Online, no rate limit', rate: 10 },
  { label: 'Offline, slow hash (bcrypt)', rate: 1e4 },
  { label: 'Offline, fast hash (MD5/SHA-1, GPU rig)', rate: 1e11 },
];

export function crackTime(entropyBits, rate) {
  const seconds = 2 ** entropyBits / 2 / rate;
  return formatDuration(seconds);
}

export function formatDuration(s) {
  if (!Number.isFinite(s) || s > 1e18) return 'longer than the universe';
  if (s < 1) return 'instantly';
  const units = [['century', 3153600000], ['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  for (const [name, secs] of units) {
    if (s >= secs) {
      const v = Math.floor(s / secs);
      if (name === 'century' && v > 1000) return `${v.toExponential(1)} centuries`;
      return `${v.toLocaleString()} ${name === 'century' ? (v === 1 ? 'century' : 'centuries') : name + (v === 1 ? '' : 's')}`;
    }
  }
  return 'instantly';
}
