// Language registry for the Code Formatter & Minifier. Every engine is lazy-loaded on first use.

const PRETTIER_PLUGINS = {
  babel: () => import('prettier/plugins/babel'),
  estree: () => import('prettier/plugins/estree'),
  typescript: () => import('prettier/plugins/typescript'),
  html: () => import('prettier/plugins/html'),
  postcss: () => import('prettier/plugins/postcss'),
  markdown: () => import('prettier/plugins/markdown'),
  yaml: () => import('prettier/plugins/yaml'),
  graphql: () => import('prettier/plugins/graphql'),
  angular: () => import('prettier/plugins/angular'),
  xml: () => import('@prettier/plugin-xml'),
  php: () => import('@prettier/plugin-php/standalone'),
  java: () => import('prettier-plugin-java'),
};

const WEB = ['html', 'postcss', 'babel', 'estree'];

// engine: prettier | sql | ruff | gofmt | clang | lua | zig
export const LANGUAGES = {
  javascript: { label: 'JavaScript / JSX', group: 'Web', monaco: 'javascript', ext: 'js', engine: 'prettier', parser: 'babel', plugins: ['babel', 'estree'], minify: 'terser' },
  typescript: { label: 'TypeScript / TSX', group: 'Web', monaco: 'typescript', ext: 'ts', engine: 'prettier', parser: 'typescript', plugins: ['typescript', 'estree'] },
  json: { label: 'JSON', group: 'Web', monaco: 'json', ext: 'json', engine: 'prettier', parser: 'json', plugins: ['babel', 'estree'], minify: 'json' },
  html: { label: 'HTML', group: 'Web', monaco: 'html', ext: 'html', engine: 'prettier', parser: 'html', plugins: WEB, minify: 'html' },
  css: { label: 'CSS', group: 'Web', monaco: 'css', ext: 'css', engine: 'prettier', parser: 'css', plugins: ['postcss'], minify: 'csso' },
  scss: { label: 'SCSS', group: 'Web', monaco: 'scss', ext: 'scss', engine: 'prettier', parser: 'scss', plugins: ['postcss'], minify: 'css-basic' },
  less: { label: 'Less', group: 'Web', monaco: 'less', ext: 'less', engine: 'prettier', parser: 'less', plugins: ['postcss'], minify: 'css-basic' },
  vue: { label: 'Vue SFC', group: 'Web', monaco: 'html', ext: 'vue', engine: 'prettier', parser: 'vue', plugins: WEB },
  angular: { label: 'Angular template', group: 'Web', monaco: 'html', ext: 'html', engine: 'prettier', parser: 'angular', plugins: [...WEB, 'angular'] },
  graphql: { label: 'GraphQL', group: 'Web', monaco: 'graphql', ext: 'graphql', engine: 'prettier', parser: 'graphql', plugins: ['graphql'], minify: 'graphql' },
  markdown: { label: 'Markdown', group: 'Docs & config', monaco: 'markdown', ext: 'md', engine: 'prettier', parser: 'markdown', plugins: ['markdown'] },
  yaml: { label: 'YAML', group: 'Docs & config', monaco: 'yaml', ext: 'yaml', engine: 'prettier', parser: 'yaml', plugins: ['yaml'] },
  xml: { label: 'XML', group: 'Docs & config', monaco: 'xml', ext: 'xml', engine: 'prettier', parser: 'xml', plugins: ['xml'], minify: 'xml' },
  svg: { label: 'SVG', group: 'Docs & config', monaco: 'xml', ext: 'svg', engine: 'prettier', parser: 'xml', plugins: ['xml'], minify: 'svgo' },
  sql: { label: 'SQL', group: 'Backend', monaco: 'sql', ext: 'sql', engine: 'sql', minify: 'sql' },
  php: { label: 'PHP', group: 'Backend', monaco: 'php', ext: 'php', engine: 'prettier', parser: 'php', plugins: ['php'], indent: 4 },
  python: { label: 'Python (Ruff)', group: 'Backend', monaco: 'python', ext: 'py', engine: 'ruff', indent: 4 },
  go: { label: 'Go (gofmt)', group: 'Backend', monaco: 'go', ext: 'go', engine: 'gofmt' },
  java: { label: 'Java', group: 'Backend', monaco: 'java', ext: 'java', engine: 'prettier', parser: 'java', plugins: ['java'], indent: 4 },
  c: { label: 'C (clang-format)', group: 'Backend', monaco: 'c', ext: 'c', engine: 'clang', file: 'main.c' },
  cpp: { label: 'C++ (clang-format)', group: 'Backend', monaco: 'cpp', ext: 'cpp', engine: 'clang', file: 'main.cpp' },
  csharp: { label: 'C# (clang-format)', group: 'Backend', monaco: 'csharp', ext: 'cs', engine: 'clang', file: 'Program.cs', indent: 4 },
  objc: { label: 'Objective-C (clang-format)', group: 'Backend', monaco: 'objective-c', ext: 'm', engine: 'clang', file: 'main.m' },
  proto: { label: 'Protocol Buffers', group: 'Backend', monaco: 'protobuf', ext: 'proto', engine: 'clang', file: 'schema.proto' },
  lua: { label: 'Lua', group: 'Backend', monaco: 'lua', ext: 'lua', engine: 'lua' },
  zig: { label: 'Zig', group: 'Backend', monaco: 'plaintext', ext: 'zig', engine: 'zig' },
};

export const CLANG_STYLES = ['Google', 'LLVM', 'Chromium', 'Mozilla', 'WebKit', 'Microsoft', 'GNU'];

const wasmReady = {};
async function wasm(name, loader) {
  if (!wasmReady[name]) wasmReady[name] = loader().then(async (m) => { await m.default(); return m; });
  return wasmReady[name];
}

export async function formatCode(langId, code, opts) {
  const lang = LANGUAGES[langId];
  switch (lang.engine) {
    case 'prettier': {
      const prettier = await import('prettier/standalone');
      const plugins = (await Promise.all(lang.plugins.map((p) => PRETTIER_PLUGINS[p]()))).map((m) => m.default || m);
      return prettier.format(code, {
        parser: lang.parser, plugins,
        tabWidth: opts.indent, useTabs: opts.useTabs, printWidth: opts.printWidth,
        semi: opts.semi, singleQuote: opts.singleQuote, trailingComma: 'all',
        ...(lang.parser === 'xml' && { xmlWhitespaceSensitivity: 'ignore' }),
        ...(lang.parser === 'php' && { phpVersion: '8.2' }),
      });
    }
    case 'sql': {
      const { format } = await import('sql-formatter');
      return format(code, { language: opts.sqlDialect || 'sql', tabWidth: opts.indent, useTabs: opts.useTabs, keywordCase: 'upper' });
    }
    case 'ruff': {
      const m = await wasm('ruff', () => import('@wasm-fmt/ruff_fmt/web'));
      return m.format(code, 'main.py', { indent_width: opts.indent, line_width: opts.printWidth, indent_style: opts.useTabs ? 'tab' : 'space', quote_style: opts.singleQuote ? 'single' : 'double' });
    }
    case 'gofmt': {
      const m = await wasm('gofmt', () => import('@wasm-fmt/gofmt/web'));
      return m.format(code);
    }
    case 'clang': {
      const m = await wasm('clang', () => import('@wasm-fmt/clang-format/web'));
      const style = JSON.stringify({ BasedOnStyle: opts.clangStyle, IndentWidth: opts.indent, ColumnLimit: opts.printWidth, UseTab: opts.useTabs ? 'Always' : 'Never' });
      return m.format(code, lang.file, style);
    }
    case 'lua': {
      const m = await wasm('lua', () => import('@wasm-fmt/lua_fmt/web'));
      return m.format(code, { indent_width: opts.indent, indent_style: opts.useTabs ? 'tab' : 'space', line_width: opts.printWidth });
    }
    case 'zig': {
      const m = await wasm('zig', () => import('@wasm-fmt/zig_fmt/web'));
      return m.format(code);
    }
    default:
      throw new Error('Unsupported language');
  }
}

// Whitespace/comment stripping outside string literals for simple grammars.
function stripOutsideStrings(code, commentRe) {
  const parts = code.split(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/);
  return parts.map((p, i) => (i % 2 ? p : p.replace(commentRe, ' ').replace(/\s+/g, ' ').replace(/\s*([{}()[\]:;,=!|&])\s*/g, '$1'))).join('').trim();
}

export async function minifyCode(langId, code) {
  const kind = LANGUAGES[langId].minify;
  switch (kind) {
    case 'terser': {
      const { minify } = await import('terser');
      try {
        const r = await minify(code, { compress: { passes: 2 }, mangle: true, format: { comments: false }, module: /\b(import|export)\b/.test(code) });
        return r.code;
      } catch (e) {
        if (/<[A-Za-z]/.test(code)) throw new Error(`${e.message} — JSX can't be minified directly; compile it to plain JavaScript first (Format still works).`);
        throw e;
      }
    }
    case 'json': return JSON.stringify(JSON.parse(code));
    case 'csso': {
      const { minify } = await import('csso');
      return minify(code, { restructure: true }).css;
    }
    case 'css-basic':
      return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();
    case 'html': {
      const { minify } = await import('html-minifier-terser/dist/htmlminifier.esm.bundle');
      return minify(code, {
        collapseWhitespace: true, conservativeCollapse: false, removeComments: true, removeRedundantAttributes: true,
        removeScriptTypeAttributes: true, removeStyleLinkTypeAttributes: true, useShortDoctype: true, minifyCSS: true, minifyJS: true, collapseBooleanAttributes: true,
      });
    }
    case 'svgo': {
      const { optimize } = await import('svgo/browser');
      return optimize(code, { multipass: true }).data;
    }
    case 'xml': return code.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
    case 'sql': return stripOutsideStrings(code, /--[^\n]*|\/\*[\s\S]*?\*\//g).replace(/\s*([(),;=])\s*/g, '$1');
    case 'graphql': return stripOutsideStrings(code, /#[^\n]*/g);
    default: throw new Error('Minify is not available for this language');
  }
}

// Minify needs plain JS (no JSX)
export const MINIFY_SAMPLES = {
  javascript: `// Debounce helper
export function debounce(fn, wait = 300) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

export const formatPrice = (amount, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);`,
};

export const SAMPLES = {
  javascript: `const fetchUser=async(id)=>{const res=await fetch(\`/api/users/\${id}\`,{headers:{'Accept':'application/json'}});if(!res.ok){throw new Error("Request failed: "+res.status)}return res.json()}
export default function App({users}){return <ul className="list">{users.map(u=><li key={u.id}>{u.name}</li>)}</ul>}`,
  typescript: `interface User{id:number;name:string;email?:string}
export async function getUsers(limit:number=10):Promise<User[]>{const r=await fetch('/api/users?limit='+limit);return (await r.json()) as User[]}`,
  json: '{"name":"devforge","version":"2.0.0","scripts":{"dev":"next dev","build":"next build"},"keywords":["tools","security"]}',
  html: '<!DOCTYPE html><html><head><title>Demo</title><style>body{margin:0;font-family:system-ui}</style></head><body><!-- nav --><nav class="top"><a href="/">Home</a><a href="/about">About</a></nav><main><h1>Hello</h1><p>Some   text.</p></main><script>console.log("hi")</script></body></html>',
  css: '.card{display:flex;flex-direction:column;padding:16px 20px;border:1px solid #e2e8f0;border-radius:12px}.card:hover{box-shadow:0 8px 24px rgba(0,0,0,.08)}@media (max-width:640px){.card{padding:12px}}',
  scss: '$primary:#4f46e5;.btn{color:$primary;&:hover{color:darken($primary,10%)}.icon{margin-right:4px}}',
  less: '@primary:#4f46e5;.btn{color:@primary;&:hover{color:darken(@primary,10%)}}',
  vue: '<template><div class="app"><h1>{{title}}</h1><button @click="count++">Clicked {{count}}</button></div></template><script>export default{data(){return{title:"Hi",count:0}}}</script><style scoped>.app{text-align:center}</style>',
  angular: '<div *ngFor="let item of items; trackBy: trackById" [class.active]="item.active" (click)="select(item)">{{item.name | uppercase}}</div>',
  graphql: 'query GetUser($id: ID!){user(id:$id){id name posts(first:5){edges{node{title}}}}}',
  markdown: '# Title\nSome *text*   here.\n* item one\n* item two\n\n|a|b|\n|-|-|\n|1|2|',
  yaml: 'services:\n    web: {image: "nginx", ports: ["80:80"]}\n    db:\n        image: postgres',
  xml: '<?xml version="1.0"?><catalog><book id="1"><title>XML Guide</title><price>44.95</price></book><!-- more --><book id="2"><title>Rain</title></book></catalog>',
  svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><!-- icon --><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6 L12 12 L16 14"/></g></svg>',
  sql: "select u.id, u.name, count(o.id) orders from users u left join orders o on o.user_id = u.id where u.status in ('active','trial') group by u.id, u.name order by orders desc;",
  php: '<?php\nnamespace App\\Http\\Controllers;\nclass UserController extends Controller{public function show($id){$user=User::findOrFail($id);return view("user.show",["user"=>$user]);}}',
  python: 'import os,sys\ndef greet(name,greeting = "Hello"):\n  if name==None :return\n  print( f"{greeting}, {name}!" )\nclass User :\n    def __init__(self,name):self.name=name',
  go: 'package main\nimport "fmt"\nfunc main(){\nnums:=[]int{1,2,3}\nfor i,n:=range nums{fmt.Println(i,n)}\n}',
  java: 'public class Main{public static void main(String[] args){int[] nums={1,2,3};for(int n:nums){if(n%2==0){System.out.println("even "+n);}else{System.out.println("odd "+n);}}}}',
  c: '#include <stdio.h>\nint main(void){int a[]={1,2,3};for(int i=0;i<3;i++){if(a[i]%2==0)printf("%d even\\n",a[i]);}return 0;}',
  cpp: '#include <vector>\n#include <iostream>\nint main(){std::vector<int> v{3,1,2};for(auto&x:v){std::cout<<x<<"\\n";}return 0;}',
  csharp: 'using System;namespace App{class Program{static void Main(string[] args){var list=new[]{1,2,3};foreach(var n in list){Console.WriteLine(n);}}}}',
  objc: '#import <Foundation/Foundation.h>\n@interface Greeter:NSObject\n-(void)greet:(NSString*)name;\n@end',
  proto: 'syntax="proto3";package demo;message User{string id=1;string name=2;repeated string tags=3;}',
  lua: 'local function greet(name) if name==nil then return end print("Hello, "..name) end\nfor i=1,3 do greet("user"..i) end',
  zig: 'const std = @import("std");\npub fn main() void {\nstd.debug.print("Hello {s}\\n", .{"zig"});\n}',
};
