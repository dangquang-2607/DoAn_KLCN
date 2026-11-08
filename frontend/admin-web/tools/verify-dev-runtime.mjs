/* Exercise the served Vite module graph, including routes loaded after startup. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const cacheRoot = path.join(root, 'node_modules/.cache');
fs.mkdirSync(cacheRoot, { recursive: true });
const cacheDir = fs.mkdtempSync(path.join(cacheRoot, 'admin-react-runtime-'));
const serve = process.argv.includes('--serve');
const emailFixture = process.argv.includes('--email-fixture');
// Browser probe uses the real UI with a local-only fake session and no backend requests.
const probe = `<!doctype html><html lang="vi"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Admin runtime QA — dữ liệu giả</title><div id="root"></div>
<script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '/src/dung-chung/connect-api/api.js';
import App from '/src/ung-dung/App.jsx';
import '/src/dung-chung/CSS/base.css';
import '/src/dung-chung/CSS/ui.css';
import '/src/dung-chung/CSS/shell.css';
import '/src/dung-chung/CSS/workspace.css';
api.defaults.adapter = async config => {
  if (config.url === '/auth/me') return { config, status: 200, headers: {}, data: {
    id: 'runtime-qa', full_name: 'Kiểm tra runtime', email: 'runtime@example.invalid',
    role: 'ADMIN', is_system_account: true, support_only: false, must_change_password: false
  }};
  if (config.url === '/auth/sessions') return { config, status: 200, headers: {}, data: [] };
  if (${emailFixture} && config.url === '/admin/email/logs') {
    const all = ['UNKNOWN', 'SENDING', 'SENT', 'FAILED', 'LOGGED_DEV'].map((status, index) => ({
      id: 'email-qa-' + index, recipient: 'runtime@example.invalid', recipient_email: 'runtime@example.invalid',
      subject: 'Email QA ' + status, email_type: 'TEST_EMAIL', status,
      created_at: '2026-11-07T10:00:00Z', preview_available: false,
      error_message: status === 'UNKNOWN' ? 'DELIVERY_UNCONFIRMED' : null,
    }));
    const items = all.filter(row => !config.params?.status || row.status === config.params.status);
    const count = status => items.filter(row => row.status === status).length;
    return { config, status: 200, headers: {}, data: { items, total: items.length,
      summary: { sent: count('SENT'), failed: count('FAILED'), preview: count('LOGGED_DEV'),
        unknown: count('UNKNOWN'), sending: count('SENDING'), needs_attention: count('FAILED') + count('UNKNOWN') } } };
  }
  if (${emailFixture} && config.url === '/admin/email/settings') return { config, status: 200, headers: {}, data: {} };
  throw Object.assign(new Error('QA: kiểm tra giao diện khi API lỗi'), { response: { status: 503 }, config });
};
sessionStorage.setItem('admin_access_token', 'runtime-qa-not-a-real-token');
history.replaceState(null, '', '${emailFixture ? '/email-logs' : '/audit-logs'}');
const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode, null,
  React.createElement(QueryClientProvider, { client: cache }, React.createElement(App))));
</script></html>`;
let server;
try {
  server = await createServer({
    root, configFile: path.join(root, 'vite.config.js'), cacheDir, logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, open: false,
      proxy: { '/api/v1': { target: 'http://127.0.0.1:9' } } },
    plugins: serve ? [{ name: 'runtime-qa-page', configureServer(dev) {
      dev.middlewares.use('/__runtime-check', async (_req, res, next) => {
        try {
          const html = await dev.transformIndexHtml('/__runtime-check', probe);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(html);
        } catch (error) { next(error); }
      });
    } }] : [],
  });
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  const get = async url => {
    const res = await fetch(base + url);
    assert.equal(res.status, 200, url);
    assert.match(res.headers.get('cache-control'), /no-store/, `Browser cache: ${url}`);
    assert.equal(res.headers.get('cloudflare-cdn-cache-control'), 'no-store', `CDN cache: ${url}`);
    return res.text();
  };
  const reactUrl = text => /["'](\/node_modules\/[^"']*\/react\.js\?v=[^"']+)["']/.exec(text)?.[1];
  const mainBefore = await get('/src/main.jsx');
  const canonical = reactUrl(mainBefore);
  assert.ok(canonical, 'Entry phải import React đã tối ưu');
  const app = await get('/src/ung-dung/App.jsx');
  const lazyImports = [...app.matchAll(/import\(["'](\/src\/[^"']+)["']\)/g)].map(match => match[1]);
  assert.ok(lazyImports.length >= 10, 'Phải kiểm tra cả các route lazy');
  let checked = 0;
  for (const url of [...lazyImports, '/src/dung-chung/tien-ich/hooks.js']) {
    const module = await get(url);
    const imported = reactUrl(module);
    if (imported) { assert.equal(imported, canonical, `React khác phiên: ${url}`); checked++; }
  }
  const rendererUrl = /["'](\/node_modules\/[^"']*\/react-dom_client\.js\?v=[^"']+)["']/.exec(mainBefore)?.[1];
  assert.ok(rendererUrl, 'Entry phải import React DOM');
  assert.equal(reactUrl(await get(rendererUrl)), canonical, 'Renderer và hook phải dùng cùng module React');
  assert.equal(reactUrl(await get('/src/main.jsx')), canonical, 'Tải route lazy không được đổi module React');
  assert.ok(checked >= 9, 'Chưa kiểm tra đủ module có hook');
  console.log(JSON.stringify({ passed: true, lazy_modules: lazyImports.length,
    modules_with_shared_react: checked, renderer_matches_hooks: true,
    browser_and_cdn_no_store: true, isolated_cache: true, backend_requests: 0,
    ...(serve ? { browser_probe: base + '/__runtime-check', probe_api: emailFixture ? 'email-status-fixtures' : 'mock-503' } : {}) }));
  if (serve) {
    await new Promise(resolve => {
      process.once('SIGINT', resolve); process.once('SIGTERM', resolve);
      process.stdin.on('data', data => { if (data.toString().includes('stop')) resolve(); });
      process.stdin.resume();
    });
    process.stdin.pause();
  }
} finally {
  await server?.close();
  assert.equal(path.dirname(cacheDir), cacheRoot);
  fs.rmSync(cacheDir, { recursive: true, force: true });
}
