import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'src');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const files = walk(source);
const code = files.filter(f => /\.[jt]sx?$/.test(f));
const parsed = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
const options = ts.parseJsonConfigFileContent(parsed.config, ts.sys, root).options;
const relative = file => path.relative(root, file).replaceAll('\\', '/');
const resolve = (file, spec) => {
  const base = spec.startsWith('@/') ? path.join(source, spec.slice(2)) : path.resolve(path.dirname(file), spec);
  const raw = ['', '.ts', '.tsx', '.css', '.svg', '/index.ts', '/index.tsx'].map(ext => base + ext).find(f => fs.existsSync(f) && fs.statSync(f).isFile());
  return raw || ts.resolveModuleName(spec, file, options, ts.sys).resolvedModule?.resolvedFileName;
};
const edges = new Map(), imports = [], exports = [], words = new Set(), prefixes = new Set();
let cssMembers = 0;
for (const file of code) {
  const text = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const targets = [];
  const modules = new Map();
  const add = (spec, names = []) => {
    if (!spec.startsWith('.') && !spec.startsWith('@/')) return;
    const target = resolve(file, spec);
    assert.ok(target, `Import không tồn tại: ${relative(file)} → ${spec}`);
    targets.push(target); imports.push({ from: relative(file), spec, target: relative(target), names });
  };
  const collect = value => { for (const m of value.matchAll(/[a-zA-Z_][\w-]*/g)) words.add(m[0]); };
  const visit = node => {
    if (ts.isStringLiteralLike(node)) collect(node.text);
    if (ts.isTemplateExpression(node)) {
      for (const literal of [node.head.text, ...node.templateSpans.map(span => span.literal.text)]) {
        collect(literal);
        const prefix = /([a-zA-Z][\w-]*-)$/.exec(literal)?.[1];
        if (prefix) prefixes.add(prefix);
      }
    }
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const names = [];
      if (node.importClause?.name) names.push('default');
      const binding = node.importClause?.namedBindings || node.exportClause;
      if (binding && (ts.isNamedImports(binding) || ts.isNamedExports(binding))) names.push(...binding.elements.map(e => (e.propertyName || e.name).text));
      if (binding && ts.isNamespaceImport(binding)) names.push('*');
      const spec = node.moduleSpecifier.text;
      add(spec, names);
      if (node.importClause?.name && spec.endsWith('.module.css')) {
        const css = fs.readFileSync(resolve(file, spec), 'utf8').replace(/:global\([^)]*\)/g, '');
        const classes = new Set([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m => m[1]));
        modules.set(node.importClause.name.text, classes);
      }
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && modules.has(node.expression.text)) {
      assert.ok(modules.get(node.expression.text).has(node.name.text), `CSS Module thiếu ${node.getText(ast)} trong ${relative(file)}`); cssMembers++;
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) add(node.arguments[0].text, ['*']);
    if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      const names = node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword) ? ['default'] :
        node.name ? [node.name.text] : node.declarationList?.declarations.map(d => d.name.getText(ast)) || [];
      exports.push(...names.map(name => ({ file: relative(file), name })));
    }
    ts.forEachChild(node, visit);
  };
  visit(ast); edges.set(file, targets);
}
for (const file of files.filter(f => f.endsWith('.css'))) {
  const targets = [];
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/(?:@import\s*|\bfrom\s*)["']([^"']+)["']/g)) {
    if (!match[1].startsWith('.')) continue;
    const target = resolve(file, match[1]); assert.ok(target, `CSS import không tồn tại: ${relative(file)}`); targets.push(target);
  }
  edges.set(file, targets);
}
// Next.js discovers these files by convention, without a JavaScript import.
const entries = files.filter(f => f === path.join(source, 'proxy.ts') || f.startsWith(path.join(source, 'app') + path.sep) &&
  /(?:^|[/\\])(?:page|layout|loading|error|global-error|not-found|default|template|route|icon|apple-icon|opengraph-image|twitter-image|favicon)\.[^/\\]+$/.test(f));
const routes = entries.filter(f => path.basename(f) === 'page.tsx').map(file => '/' +
  path.relative(path.join(source, 'app'), path.dirname(file)).split(path.sep).filter(p => p && !p.startsWith('(')).join('/')).sort();
assert.deepEqual(routes, ['/', '/account-support', '/accounts', '/analytics', '/budgets', '/categories', '/demo-checkout', '/demo/tong-quan', '/login', '/ocr', '/settings', '/settings/subscription', '/settings/subscription/checkout', '/support', '/transactions']);
const globalCss = fs.readFileSync(path.join(source, 'dung-chung/CSS/globals.css'), 'utf8');
assert.match(globalCss, /@import\s+["']tailwindcss["']\s+source\(["']\.\.\/\.\.\/["']\);\s*@import\s+["']\.\/swiss\.css["'];/, 'Tailwind chỉ quét src và giữ thứ tự nạp CSS nền');
const support = fs.readFileSync(path.join(source, 'app/account-support/page.tsx'), 'utf8');
assert.deepEqual([...support.matchAll(/<option value="([A-Z_]+)"/g)].map(m => m[1]).sort(), ['LOCKED', 'NO_EMAIL']);
const reached = new Set(), queue = [...entries];
while (queue.length) { const file = queue.pop(); if (reached.has(file)) continue; reached.add(file); queue.push(...(edges.get(file) || [])); }
const unreachable = files.filter(f => !reached.has(f)).map(relative);
if (!process.argv.includes('--report')) assert.deepEqual(unreachable, [], 'Có file src chưa được sử dụng');
const retired = /PAYMENT_RECONCILIATION|TRANSACTION_DISPUTE|OTP_NOT_RECEIVED|OTP_DELIVERY|ACCOUNT_TAKEOVER|SUSPICIOUS_ACCESS|SUPPORT_HOLD|user_deletion_requests|is_deleted|deletion_status/;
for (const file of code) assert.ok(!retired.test(fs.readFileSync(file, 'utf8')), `Luồng đã gỡ còn tồn tại: ${relative(file)}`);
const summary = { source_files: files.length, code_files: code.length, local_imports: imports.length, css_module_members: cssMembers, routes, account_support_cases: 2, unreachable };
if (process.argv.includes('--report')) {
  const usedExports = exports.filter(e => !['default'].includes(e.name) && !e.file.startsWith('src/app/') && !imports.some(i => i.target === e.file && (i.names.includes(e.name) || i.names.includes('*'))));
  fs.writeFileSync(path.join(root, '../../output/user-web-qa/source-audit-cleanup.json'), JSON.stringify({ ...summary, imports, exports, unusedExports: usedExports, words: [...words], prefixes: [...prefixes] }, null, 2));
}
console.log(JSON.stringify(summary));
