/* Compile the actual stylesheet; generated files outside src must not become utilities. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { transform } from 'lightningcss';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const file = path.join(root, 'src/dung-chung/CSS/globals.css');
const input = fs.readFileSync(file, 'utf8');
const probeFolder = fs.mkdtempSync(path.join(root, '.tailwind-regression-'));
const probe = '[--cf-outside-source-probe:123456]';
try {
  fs.writeFileSync(path.join(probeFolder, 'generated.html'), `<div class="${probe}"></div>`);
  const compiler = await compile(input, { base: path.dirname(file), onDependency() {} });
  assert.ok(compiler.root && compiler.root !== 'none', 'Tailwind cần khai báo thư mục nguồn');
  assert.equal(path.resolve(compiler.root.base, compiler.root.pattern), path.join(root, 'src'));
  const scanner = new Scanner({ sources: [{ ...compiler.root, negated: false }, ...compiler.sources] });
  const candidates = scanner.scan();
  assert.ok(!candidates.includes(probe), 'Không quét dữ liệu/bản build ngoài src');
  assert.ok(candidates.includes('max-w-lg') && candidates.includes('px-4'), 'Giữ utility dùng trong trang hỗ trợ');
  const result = await postcss([tailwind({ base: root, optimize: false })]).process(input, { from: file });
  assert.match(result.css, /\.max-w-lg\s*\{/, 'Giữ CSS bố cục của trang hỗ trợ');
  assert.match(result.css, /\.px-4\s*\{/, 'Giữ CSS padding đang sử dụng');
  assert.ok(!result.css.includes('--cf-outside-source-probe'), 'CSS sinh ra chứa utility từ tệp ngoài nguồn');
  assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result.css), 'CSS sinh ra chứa ký tự nhị phân');
  transform({ filename: file, code: Buffer.from(result.css), errorRecovery: false });
  console.log(JSON.stringify({ tailwind_source: 'src', scanned_files: scanner.files.length,
    outside_source_ignored: true, generated_css_parses: true, mode: 'development' }));
} finally {
  assert.equal(path.dirname(probeFolder), root);
  fs.rmSync(probeFolder, { recursive: true, force: true });
}
