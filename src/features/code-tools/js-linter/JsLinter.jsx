import { useState, useMemo } from 'react';
import { Stack, Group, Text, Badge, Paper, Table, Switch, SimpleGrid, ScrollArea } from '@mantine/core';
import { IconBug } from '@tabler/icons-react';
import * as acorn from 'acorn';
import CodeEditor from '@/shared/components/CodeEditor';
import { Panel } from '@/shared/components/ui';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useViewStore } from '@/shared/stores/view.store';

const SAMPLE = `var apiKey = "AKIAIOSFODNN7EXAMPLE";

function render(user) {
  if (user.role == "admin") {
    document.getElementById("out").innerHTML = "<b>" + user.name + "</b>";
  }
  setTimeout("refresh()", 1000);
  const token = Math.random().toString(36);
  localStorage.setItem("authToken", token);
  console.log("rendered", user);
  try { eval(user.script) } catch (e) {}
  debugger;
}
`;

const SEVERITY = { error: 'red', warning: 'orange', security: 'grape', info: 'blue' };

const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key ID'],
  [/gh[pousr]_[A-Za-z0-9]{36,}/, 'GitHub token'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/sk_live_[A-Za-z0-9]{20,}/, 'Stripe live secret key'],
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'Private key'],
  [/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/, 'JSON Web Token'],
];

function parse(code) {
  const opts = { ecmaVersion: 'latest', locations: true, allowHashBang: true, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true };
  try { return { ast: acorn.parse(code, { ...opts, sourceType: 'module' }) }; }
  catch (moduleErr) {
    try { return { ast: acorn.parse(code, { ...opts, sourceType: 'script' }) }; }
    catch { return { error: moduleErr }; }
  }
}

function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const v = node[key];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && walk(c, visit, node));
    else if (v && typeof v.type === 'string') walk(v, visit, node);
  }
}

const calleeName = (c) => (c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? `${calleeName(c.object)}.${c.property.name}` : '');

function lint(code, opts) {
  const issues = [];
  const add = (severity, line, col, message, rule) => issues.push({ severity, line, col, message, rule });
  const { ast, error } = parse(code);
  if (error) {
    add('error', error.loc?.line ?? '?', (error.loc?.column ?? 0) + 1, error.message.replace(/\s*\(\d+:\d+\)$/, ''), 'syntax');
    return issues;
  }

  walk(ast, (n) => {
    const l = n.loc.start.line, c = n.loc.start.column + 1;
    switch (n.type) {
      case 'VariableDeclaration':
        if (n.kind === 'var') add('warning', l, c, 'Use let or const instead of var', 'no-var');
        break;
      case 'BinaryExpression':
        if (n.operator === '==' || n.operator === '!=') {
          const isNull = [n.left, n.right].some((x) => x.type === 'Literal' && x.value === null);
          if (!isNull) add('warning', l, c, `Use ${n.operator}= instead of ${n.operator}`, 'eqeqeq');
        }
        break;
      case 'DebuggerStatement': add('error', l, c, 'Unexpected debugger statement', 'no-debugger'); break;
      case 'WithStatement': add('error', l, c, 'with statements are not allowed', 'no-with'); break;
      case 'CatchClause':
        if (!n.body.body.length) add('warning', l, c, 'Empty catch block swallows errors', 'no-empty');
        break;
      case 'BlockStatement':
        break;
      case 'NewExpression':
        if (n.callee.name === 'Function') add('security', l, c, 'new Function() evaluates strings as code', 'no-new-func');
        break;
      case 'CallExpression': {
        const name = calleeName(n.callee);
        if (name === 'eval' || name === 'window.eval') add('security', l, c, 'eval() executes arbitrary code (XSS / injection risk)', 'no-eval');
        if (/^(window\.)?(setTimeout|setInterval)$/.test(name) && n.arguments[0]?.type === 'Literal' && typeof n.arguments[0].value === 'string') add('security', l, c, `${name.replace('window.', '')} with a string argument is an implicit eval`, 'no-implied-eval');
        if (/^document\.(write|writeln)$/.test(name)) add('security', l, c, `${name}() can inject unescaped HTML`, 'no-document-write');
        if (/\.insertAdjacentHTML$/.test(name)) add('security', l, c, 'insertAdjacentHTML() parses HTML — sanitize input first', 'no-unsanitized');
        if (/^localStorage\.setItem$|^sessionStorage\.setItem$/.test(name) && n.arguments[0]?.type === 'Literal' && /token|jwt|secret|password|auth/i.test(String(n.arguments[0].value))) add('security', l, c, 'Storing secrets in Web Storage exposes them to any XSS', 'no-secrets-in-storage');
        if (opts.console && /^console\./.test(name)) add('info', l, c, `Unexpected ${name}()`, 'no-console');
        if (name === 'alert' || name === 'window.alert') add('info', l, c, 'Unexpected alert()', 'no-alert');
        break;
      }
      case 'MemberExpression':
        if (!n.computed && n.property.name === 'random' && n.object.name === 'Math') add('info', l, c, 'Math.random() is not cryptographically secure — use crypto.getRandomValues() for tokens/IDs', 'insecure-random');
        break;
      case 'AssignmentExpression':
        if (n.left.type === 'MemberExpression' && /^(innerHTML|outerHTML)$/.test(n.left.property?.name)) add('security', l, c, `Assigning ${n.left.property.name} can lead to XSS — use textContent or sanitize`, 'no-inner-html');
        if (n.left.type === 'MemberExpression' && n.left.property?.name === 'href' && n.right.type !== 'Literal') add('info', l, c, 'Dynamic location/href assignment — validate against javascript: URLs', 'unsafe-href');
        break;
      default:
    }
  });

  code.split('\n').forEach((line, i) => {
    for (const [re, label] of SECRET_PATTERNS) if (re.test(line)) add('security', i + 1, 1, `Possible hard-coded secret: ${label}`, 'no-secrets');
    if (opts.maxLen && line.length > 120) add('info', i + 1, 121, `Line too long (${line.length} > 120)`, 'max-len');
  });

  return issues.sort((a, b) => a.line - b.line || a.col - b.col);
}

export default function JsLinter() {
  const [input, setInput] = useState(SAMPLE);
  const [opts, setOpts] = useState({ console: true, maxLen: true });
  const { viewMode } = useViewStore();
  const code = useDebounce(input, 300);
  const issues = useMemo(() => (code.trim() ? lint(code, opts) : []), [code, opts]);
  const counts = issues.reduce((m, i) => ({ ...m, [i.severity]: (m[i.severity] || 0) + 1 }), {});
  const horiz = viewMode !== 'vertical';

  return (
    <Stack gap="md">
      <Paper p="sm">
        <Group justify="space-between">
          <Group gap="xs">
            {Object.keys(SEVERITY).map((s) => <Badge key={s} color={SEVERITY[s]} variant="light">{counts[s] || 0} {s}</Badge>)}
          </Group>
          <Group gap="md">
            <Switch size="xs" label="Report console.*" checked={opts.console} onChange={(e) => setOpts((o) => ({ ...o, console: e.currentTarget.checked }))} />
            <Switch size="xs" label="Max line length 120" checked={opts.maxLen} onChange={(e) => setOpts((o) => ({ ...o, maxLen: e.currentTarget.checked }))} />
          </Group>
        </Group>
      </Paper>
      <SimpleGrid cols={horiz ? { base: 1, lg: 2 } : 1}>
        <Paper p="xs">
          <Text size="xs" fw={600} c="dimmed" mb={6} px={4}>JavaScript (ES2024, modules or scripts)</Text>
          <CodeEditor value={input} onChange={setInput} language="javascript" height="460px" />
        </Paper>
        <Panel title={`Problems (${issues.length})`} icon={IconBug} p="xs">
          {issues.length === 0 ? (
            <Text c="teal" size="sm" p="md">✓ No problems found</Text>
          ) : (
            <ScrollArea.Autosize mah={460}>
              <Table verticalSpacing={5} striped>
                <Table.Tbody>
                  {issues.map((i, k) => (
                    <Table.Tr key={k}>
                      <Table.Td w={80}><Badge size="xs" color={SEVERITY[i.severity]} variant="light">{i.severity}</Badge></Table.Td>
                      <Table.Td w={64}><Text size="xs" ff="monospace" c="dimmed">{i.line}:{i.col}</Text></Table.Td>
                      <Table.Td><Text size="xs">{i.message}</Text></Table.Td>
                      <Table.Td w={140}><Text size="xs" ff="monospace" c="dimmed">{i.rule}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          )}
        </Panel>
      </SimpleGrid>
      <Text size="xs" c="dimmed">Parsed with acorn (JSX/TypeScript syntax is not supported). Checks run as you type, entirely in the browser.</Text>
    </Stack>
  );
}
