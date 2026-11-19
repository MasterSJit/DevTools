// Copies the Monaco editor build into public/ so the app never loads code from a third-party CDN.
// Runs automatically before `dev` and `build` (see package.json). Output is gitignored.
import { cpSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// monaco-editor's "exports" map hides package.json, so locate it on disk directly.
const root = join(process.cwd(), 'node_modules', 'monaco-editor');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const dest = join(process.cwd(), 'public', 'monaco');
const stamp = join(dest, '.version');

if (existsSync(stamp) && readFileSync(stamp, 'utf8') === version) {
  console.log(`monaco ${version} already in public/monaco`);
} else {
  rmSync(dest, { recursive: true, force: true });
  cpSync(join(root, 'min', 'vs'), join(dest, 'vs'), { recursive: true });
  writeFileSync(stamp, version);
  console.log(`copied monaco ${version} → public/monaco/vs`);
}
