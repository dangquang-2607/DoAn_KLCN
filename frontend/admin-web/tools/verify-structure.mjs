import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'src');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const files = walk(source).filter(file => /\.(?:js|jsx|css)$/.test(file));
const edges = new Map();
let references = 0, cssMembers = 0;
const resolve = (file, spec) => ['', '.js', '.jsx', '.css'].map(ext =>
  path.resolve(path.dirname(file), spec) + ext).find(target => fs.existsSync(target) && fs.statSync(target).isFile());

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const targets = [];
  const imports = [...text.matchAll(/\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']/g)];
  for (const match of imports) {
    const spec = match[1] || match[2] || match[3];
    if (!spec.startsWith('.')) continue;
    const target = resolve(file, spec);
    assert.ok(target, `Import không tồn tại: ${path.relative(root, file)} → ${spec}`);
    assert.ok(target.startsWith(source + path.sep), `Import thoát khỏi src: ${spec}`);
    targets.push(target); references++;
  }
  edges.set(file, targets);
  for (const match of text.matchAll(/import\s+(\w+)\s+from\s+["']([^"']+\.module\.css)["']/g)) {
    const css = fs.readFileSync(resolve(file, match[2]), 'utf8').replace(/:global\([^)]*\)/g, '');
    const classes = new Set([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m => m[1]));
    const members = new RegExp(`\\b${match[1]}\\.([a-zA-Z_][\\w]*)`, 'g');
    for (const member of text.matchAll(members)) {
      assert.ok(classes.has(member[1]), `CSS Module thiếu ${member[0]} trong ${match[2]}`);
      cssMembers++;
    }
  }
}
const reached = new Set(), queue = [path.join(source, 'main.jsx')];
while (queue.length) {
  const file = queue.pop();
  if (reached.has(file)) continue;
  reached.add(file); queue.push(...(edges.get(file) || []));
}
assert.deepEqual(files.filter(file => !reached.has(file)).map(file => path.relative(root, file)), [], 'Có file src không còn được sử dụng');

const routes = fs.readFileSync(path.join(source, 'ung-dung/App.jsx'), 'utf8');
assert.equal([...routes.matchAll(/<Route\s+path=/g)].length, 12, 'Số route quản trị đã thay đổi');
const support = fs.readFileSync(path.join(source, 'chuc-nang/ho-tro/SupportCases.jsx'), 'utf8');
const issueBlock = /const issues\s*=\s*\{([^}]+)\}/.exec(support)?.[1] || '';
assert.deepEqual([...issueBlock.matchAll(/\b([A-Z_]+)\s*:/g)].map(m => m[1]).sort(), ['LOCKED', 'NO_EMAIL']);
const retired = /PAYMENT_RECONCILIATION|TRANSACTION_DISPUTE|OTP_NOT_RECEIVED|OTP_DELIVERY|ACCOUNT_TAKEOVER|SUSPICIOUS_ACCESS|SUPPORT_HOLD|ACCOUNT_DELETED|ACCOUNT_RESTORED|USER_RESTORE|USER_SOFT_DELETE|USER_HARD_DELETE|SOFT_DELETE_USER|HARD_DELETE_USER_REQUESTED|RESTORE_USER|RETRY_USER_(?:FILE_)?PURGE|PURGE_PENDING|deletion_status|is_deleted|user\.deletion\b|Xóa tài khoản|Khôi phục tài khoản|Xóa mềm|Đang xóa vĩnh viễn/;
for (const file of files.filter(f => /\.jsx?$/.test(f))) assert.ok(!retired.test(fs.readFileSync(file, 'utf8')), `Luồng đã gỡ còn tồn tại: ${file}`);

console.log(JSON.stringify({ source_files: files.length, local_imports: references, css_module_members: cssMembers, unreachable: 0, account_support_cases: 2 }));
