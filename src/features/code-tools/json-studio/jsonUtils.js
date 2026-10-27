import json5 from 'json5';

/**
 * Best-effort JSON repair. Works on tokens (never inside strings), so URLs like
 * "https://x" survive — the previous regex approach stripped them as comments.
 */
export function repairJson(text) {
  const fixes = new Set();
  let src = text.replace(/^﻿/, '');
  if (src !== text) fixes.add('Removed BOM');

  // Smart quotes from Word / Slack
  if (/[“”‘’]/.test(src)) { src = src.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"); fixes.add('Replaced smart quotes'); }

  // JSONP / JS assignment wrappers: cb({...}); or const x = {...};
  const wrapped = src.match(/^\s*(?:[\w$.]+\s*\(|(?:var|let|const)\s+[\w$]+\s*=|export\s+default)\s*([\s\S]*?)\s*\)?\s*;?\s*$/);
  if (wrapped && /^[{[]/.test(wrapped[1])) { src = wrapped[1].replace(/\)\s*$/, ''); fixes.add('Removed JS/JSONP wrapper'); }

  let out = '';
  let lastSig = '';
  let sawNewline = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      if (sawNewline && /["'\d}\]a-z]/i.test(lastSig)) { out += ','; fixes.add('Inserted missing commas'); }
      let j = i + 1;
      while (j < src.length && src[j] !== ch) { if (src[j] === '\\') j++; j++; }
      out += src.slice(i, j + 1);
      i = j; lastSig = ch; sawNewline = false;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; i--; fixes.add('Removed comments'); continue; }
    if (ch === '/' && src[i + 1] === '*') { const end = src.indexOf('*/', i + 2); i = end < 0 ? src.length : end + 1; fixes.add('Removed comments'); continue; }
    if (ch === '\n') { sawNewline = true; out += ch; continue; }
    if (/\s/.test(ch)) { out += ch; continue; }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < src.length && /[\w$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      const map = { True: 'true', False: 'false', None: 'null', undefined: 'null', NULL: 'null', Null: 'null' };
      const isKey = /^\s*:/.test(src.slice(j));
      if (sawNewline && /["'\d}\]a-z]/i.test(lastSig) && !isKey) { out += ','; fixes.add('Inserted missing commas'); }
      else if (sawNewline && /["'\d}\]a-z]/i.test(lastSig) && isKey && lastSig !== ',' && lastSig !== '{') { out += ','; fixes.add('Inserted missing commas'); }
      if (!isKey && map[word]) { out += map[word]; fixes.add('Converted Python/JS literals (True/None/undefined)'); }
      else out += word;
      i = j - 1; lastSig = 'a'; sawNewline = false;
      continue;
    }
    if ((ch === '{' || ch === '[' || /[\d-]/.test(ch)) && sawNewline && /["'\d}\]a-z]/i.test(lastSig)) { out += ','; fixes.add('Inserted missing commas'); }
    out += ch;
    lastSig = ch; sawNewline = false;
  }

  let value;
  try { value = JSON.parse(out); }
  catch {
    value = json5.parse(out); // single quotes, unquoted keys, trailing commas, hex, Infinity…
    if (/,\s*[}\]]/.test(out)) fixes.add('Removed trailing commas');
    if (/'/.test(out)) fixes.add('Converted single quotes');
    if (/[{,]\s*[A-Za-z_$][\w$]*\s*:/.test(out)) fixes.add('Quoted unquoted keys');
  }
  return { value, fixes: [...fixes] };
}

/** Turns a JSON.parse error into "message (line X, column Y)". */
export function explainJsonError(text, err) {
  const m = err.message.match(/position (\d+)/);
  if (!m) return err.message;
  const pos = Number(m[1]);
  const before = text.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  return `${err.message.replace(/ in JSON at position \d+.*$/, '')} (line ${line}, column ${col})`;
}

export function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((a, k) => { a[k] = sortKeysDeep(v[k]); return a; }, {});
  return v;
}

export function jsonStats(v) {
  let keys = 0, nodes = 0, maxDepth = 0;
  const walk = (x, d) => {
    nodes++; maxDepth = Math.max(maxDepth, d);
    if (Array.isArray(x)) x.forEach((y) => walk(y, d + 1));
    else if (x && typeof x === 'object') for (const k of Object.keys(x)) { keys++; walk(x[k], d + 1); }
  };
  walk(v, 0);
  return { keys, nodes, depth: maxDepth };
}

// ── JSONPath (subset): $ . .. * [n] [a:b] ['k'] [?(@.k op v)] ──
function tokenize(path) {
  const tokens = [];
  let i = path.startsWith('$') ? 1 : 0;
  while (i < path.length) {
    if (path.startsWith('..', i)) {
      i += 2;
      const m = path.slice(i).match(/^(\*|[\w$-]+)/);
      tokens.push({ type: 'descend', key: m ? m[1] : '*' });
      i += m ? m[1].length : 0;
    } else if (path[i] === '.') {
      i++;
      const m = path.slice(i).match(/^(\*|[\w$-]+)/);
      if (!m) throw new Error(`Unexpected character at ${i}`);
      tokens.push(m[1] === '*' ? { type: 'wildcard' } : { type: 'key', key: m[1] });
      i += m[1].length;
    } else if (path[i] === '[') {
      const end = path.indexOf(']', i);
      if (end < 0) throw new Error('Unclosed [');
      const inner = path.slice(i + 1, end).trim();
      i = end + 1;
      if (inner === '*') tokens.push({ type: 'wildcard' });
      else if (/^-?\d+$/.test(inner)) tokens.push({ type: 'index', index: Number(inner) });
      else if (/^-?\d*:-?\d*$/.test(inner)) { const [a, b] = inner.split(':'); tokens.push({ type: 'slice', a: a === '' ? undefined : Number(a), b: b === '' ? undefined : Number(b) }); }
      else if (/^['"].*['"]$/.test(inner)) tokens.push({ type: 'key', key: inner.slice(1, -1) });
      else if (inner.startsWith('?')) {
        const m = inner.match(/^\?\(\s*@\.([\w$.-]+)\s*(==|!=|>=|<=|>|<)?\s*(.*?)\s*\)$/);
        if (!m) throw new Error(`Unsupported filter ${inner}`);
        let val = m[3];
        if (m[2]) { try { val = JSON.parse(val.replace(/^'(.*)'$/, '"$1"')); } catch {} }
        tokens.push({ type: 'filter', field: m[1], op: m[2], val });
      } else tokens.push({ type: 'key', key: inner });
    } else throw new Error(`Unexpected “${path[i]}” at ${i}`);
  }
  return tokens;
}

const children = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);
const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
const OPS = { '==': (a, b) => a === b, '!=': (a, b) => a !== b, '>': (a, b) => a > b, '<': (a, b) => a < b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b };

export function jsonPath(data, path) {
  let cur = [data];
  for (const t of tokenize(path.trim())) {
    const next = [];
    for (const v of cur) {
      if (t.type === 'key') { if (v && typeof v === 'object' && t.key in v) next.push(v[t.key]); }
      else if (t.type === 'wildcard') next.push(...children(v));
      else if (t.type === 'index') { if (Array.isArray(v)) { const x = v[t.index < 0 ? v.length + t.index : t.index]; if (x !== undefined) next.push(x); } }
      else if (t.type === 'slice') { if (Array.isArray(v)) next.push(...v.slice(t.a, t.b)); }
      else if (t.type === 'filter') next.push(...children(v).filter((c) => { const x = getPath(c, t.field); return t.op ? OPS[t.op](x, t.val) : x !== undefined; }));
      else if (t.type === 'descend') {
        const walk = (x) => {
          if (x && typeof x === 'object') {
            if (t.key === '*') next.push(...children(x));
            else if (!Array.isArray(x) && t.key in x) next.push(x[t.key]);
            children(x).forEach(walk);
          }
        };
        walk(v);
      }
    }
    cur = next;
  }
  return cur;
}

// ── CSV ──
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return out;
}

const csvCell = (v, sep) => {
  if (v == null) return '';
  const s = String(v);
  return s.includes(sep) || /["\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function jsonToCsv(data, sep = ',') {
  const rows = (Array.isArray(data) ? data : [data]).map((r) => (r && typeof r === 'object' ? flatten(r) : { value: r }));
  const headers = [...new Set(rows.flatMap(Object.keys))];
  return [headers.map((h) => csvCell(h, sep)).join(sep), ...rows.map((r) => headers.map((h) => csvCell(r[h], sep)).join(sep))].join('\n');
}

export function csvToJson(text, sep = ',') {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x !== ''));
  if (!head) return [];
  const cast = (v) => (v === '' ? null : v === 'true' ? true : v === 'false' ? false : /^-?\d+(\.\d+)?$/.test(v) && !/^0\d/.test(v) ? Number(v) : v);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, cast(r[i] ?? '')])));
}

// ── TypeScript interface generation ──
export function jsonToTs(data, rootName = 'Root') {
  const interfaces = [];
  const seen = new Map();
  const pascal = (s) => (s.replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase()) || 'Item');
  const safeKey = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));

  const typeOf = (v, name) => {
    if (v === null) return 'null';
    if (Array.isArray(v)) {
      if (!v.length) return 'unknown[]';
      const objs = v.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
      const types = new Set(v.filter((x) => !(x && typeof x === 'object' && !Array.isArray(x))).map((x) => typeOf(x, name)));
      if (objs.length) {
        // Merge object shapes; keys missing from some items become optional.
        const merged = {};
        const counts = {};
        objs.forEach((o) => Object.entries(o).forEach(([k, val]) => { counts[k] = (counts[k] || 0) + 1; if (!(k in merged) || merged[k] === null) merged[k] = val; }));
        types.add(build(merged, pascal(name.replace(/s$/, '')), (k) => counts[k] < objs.length));
      }
      const list = [...types];
      return list.length === 1 ? `${list[0]}[]` : `(${list.join(' | ')})[]`;
    }
    if (typeof v === 'object') return build(v, pascal(name));
    return typeof v;
  };

  const build = (obj, name, optional = () => false) => {
    const body = Object.entries(obj).map(([k, v]) => `  ${safeKey(k)}${optional(k) ? '?' : ''}: ${typeOf(v, k)};`).join('\n');
    if (seen.has(body)) return seen.get(body);
    let n = name, i = 2;
    while (interfaces.some((x) => x.name === n)) n = `${name}${i++}`;
    seen.set(body, n);
    interfaces.push({ name: n, body });
    return n;
  };

  const root = typeOf(data, rootName);
  const out = interfaces.reverse().map((x) => `export interface ${x.name} {\n${x.body}\n}`).join('\n\n');
  return interfaces.some((x) => x.name === root) ? out : `${out}${out ? '\n\n' : ''}export type ${rootName} = ${root};`;
}
